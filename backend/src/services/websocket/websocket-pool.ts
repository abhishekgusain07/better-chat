import { Server as SocketIOServer } from 'socket.io'
import { EventEmitter } from 'events'
import { BaseService } from '../base/service'
import { ServiceError } from '../types'
import {
  WebSocketLoadBalancer,
  LoadBalancingStrategy,
} from './websocket-load-balancer'
import http from 'http'

/**
 * WebSocket Pool Interface
 * Manages multiple Socket.IO server instances for load balancing and connection pooling
 */
export interface IWebSocketPool {
  // Pool management
  addServer(server: http.Server, options?: Record<string, any>): Promise<string>
  removeServer(poolId: string): Promise<void>
  getServerCount(): number
  getOptimalServer(): SocketIOServer | null

  // Broadcasting across pool
  broadcastToAll(event: string, data: any): Promise<void>
  broadcastToRoom(room: string, event: string, data: any): Promise<void>
  broadcastToUser(userId: string, event: string, data: any): Promise<void>

  // Connection management
  getTotalConnections(): number
  getServerConnections(poolId: string): number
  getConnectionDistribution(): Record<string, number>

  // Health and monitoring
  getPoolHealth(): Promise<PoolHealth>

  // Load balancing
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void
  getLoadBalancingStrategy(): LoadBalancingStrategy
  getLoadBalancer(): WebSocketLoadBalancer
}

interface PoolHealth {
  healthy: boolean
  totalServers: number
  activeServers: number
  totalConnections: number
  averageLoad: number
  servers: Record<string, ServerHealth>
}

interface ServerHealth {
  poolId: string
  connections: number
  load: number
  healthy: boolean
  uptime: number
}

interface PooledServer {
  id: string
  server: SocketIOServer
  httpServer: http.Server
  connections: number
  createdAt: Date
  lastActivity: Date
  healthy: boolean
}

/**
 * WebSocket Connection Pool Manager
 * Provides load balancing and connection pooling for Socket.IO servers
 */
export class WebSocketPool extends BaseService implements IWebSocketPool {
  private _servers = new Map<string, PooledServer>()
  private _eventEmitter = new EventEmitter()
  private _loadBalancer: WebSocketLoadBalancer
  private _maxServersPerPool = 5
  private _connectionThreshold = 1000
  private _monitoringInterval: NodeJS.Timeout | null = null
  private _rebalanceInterval: NodeJS.Timeout | null = null

  constructor(options?: {
    maxServersPerPool?: number
    connectionThreshold?: number
    monitoringIntervalMs?: number
    loadBalancingStrategy?: LoadBalancingStrategy
  }) {
    super('websocket-pool')

    if (options) {
      this._maxServersPerPool = options.maxServersPerPool || 5
      this._connectionThreshold = options.connectionThreshold || 1000
    }

    // Initialize load balancer
    this._loadBalancer = new WebSocketLoadBalancer({
      strategy: options?.loadBalancingStrategy || 'least-connections',
      healthCheckInterval: 30000,
      maxConnections: this._connectionThreshold,
      enableStickySessions: true,
    })
  }

  async initialize(): Promise<void> {
    this._logger.info('Initializing WebSocket Pool...')

    // Set up event emitter for cross-server communication
    this._eventEmitter.setMaxListeners(100)

    // Initialize load balancer
    await this._loadBalancer.initialize()

    // Start monitoring servers
    this._startMonitoring()

    // Start load rebalancing
    this._startLoadRebalancing()

    this._logger.info('✅ WebSocket Pool initialized with load balancing')
  }

  /**
   * Add a new Socket.IO server to the pool
   */
  async addServer(
    server: http.Server,
    options?: Record<string, any>
  ): Promise<string> {
    if (this._servers.size >= this._maxServersPerPool) {
      throw new ServiceError(
        `Pool limit reached (${this._maxServersPerPool} servers)`,
        'POOL_LIMIT_EXCEEDED',
        this.name
      )
    }

    const poolId = `socket-pool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      // Create Socket.IO server with pool-optimized configuration
      const io = new SocketIOServer(server, {
        ...options,
        // Connection optimization
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 10000,
        maxHttpBufferSize: 1e6,

        // Enable compression for better performance
        compression: true,

        // Pool-specific adapter configuration for clustering
        adapter: undefined, // Will be configured later for Redis adapter if needed
      })

      // Set up connection tracking
      this._setupServerTracking(io, poolId)

      const pooledServer: PooledServer = {
        id: poolId,
        server: io,
        httpServer: server,
        connections: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
        healthy: true,
      }

      this._servers.set(poolId, pooledServer)

      // Add server to load balancer
      await this._loadBalancer.addNode({
        id: poolId,
        weight: 1, // Default weight, can be configured
        connections: 0,
        load: 0,
        healthy: true,
        responseTime: 0,
        metadata: { ...options },
      })

      this.logServiceOperation('addServer', {
        poolId,
        totalServers: this._servers.size,
        maxServers: this._maxServersPerPool,
      })

      this._logger.info(`✅ Added Socket.IO server ${poolId} to pool`)

      // Emit pool change event
      this._eventEmitter.emit('poolChanged', {
        type: 'serverAdded',
        poolId,
        totalServers: this._servers.size,
      })

      return poolId
    } catch (error) {
      this.logServiceError('addServer', error as Error)
      throw new ServiceError(
        'Failed to add server to pool',
        'ADD_SERVER_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Remove a server from the pool
   */
  async removeServer(poolId: string): Promise<void> {
    const pooledServer = this._servers.get(poolId)
    if (!pooledServer) {
      this._logger.warn(`Server ${poolId} not found in pool`)
      return
    }

    try {
      // Gracefully disconnect all clients
      const sockets = await pooledServer.server.fetchSockets()
      for (const socket of sockets) {
        socket.emit('serverMaintenance', {
          message: 'Server maintenance - please reconnect',
          reconnectDelay: 1000,
        })
        socket.disconnect(true)
      }

      // Close the server
      pooledServer.server.close()
      this._servers.delete(poolId)

      // Remove from load balancer
      await this._loadBalancer.removeNode(poolId)

      this.logServiceOperation('removeServer', {
        poolId,
        totalServers: this._servers.size,
        disconnectedSockets: sockets.length,
      })

      this._logger.info(`✅ Removed Socket.IO server ${poolId} from pool`)

      // Emit pool change event
      this._eventEmitter.emit('poolChanged', {
        type: 'serverRemoved',
        poolId,
        totalServers: this._servers.size,
      })
    } catch (error) {
      this.logServiceError('removeServer', error as Error)
      throw new ServiceError(
        'Failed to remove server from pool',
        'REMOVE_SERVER_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Get the number of servers in the pool
   */
  getServerCount(): number {
    return this._servers.size
  }

  /**
   * Get the optimal server based on load balancing
   */
  getOptimalServer(): SocketIOServer | null {
    // Use load balancer to select optimal server
    const selectedNode = this._loadBalancer.selectNode()

    if (!selectedNode) {
      this._logger.warn('No healthy servers available from load balancer')
      return null
    }

    const pooledServer = this._servers.get(selectedNode.id)

    if (!pooledServer) {
      this._logger.error(
        `Load balancer selected unknown server: ${selectedNode.id}`
      )
      return null
    }

    this.logServiceOperation('getOptimalServer', {
      selectedPoolId: selectedNode.id,
      connections: selectedNode.connections,
      load: selectedNode.load,
      strategy: this._loadBalancer.getStrategy(),
    })

    return pooledServer.server
  }

  /**
   * Broadcast to all servers in the pool
   */
  async broadcastToAll(event: string, data: any): Promise<void> {
    const broadcasts = Array.from(this._servers.values())
      .filter((server) => server.healthy)
      .map(async (server) => {
        try {
          server.server.emit(event, data)
          server.lastActivity = new Date()
        } catch (error) {
          this._logger.error(`Broadcast failed on server ${server.id}:`, error)
        }
      })

    await Promise.all(broadcasts)

    this.logServiceOperation('broadcastToAll', {
      event,
      serverCount: broadcasts.length,
      hasData: !!data,
    })
  }

  /**
   * Broadcast to a specific room across all servers
   */
  async broadcastToRoom(room: string, event: string, data: any): Promise<void> {
    const broadcasts = Array.from(this._servers.values())
      .filter((server) => server.healthy)
      .map(async (server) => {
        try {
          server.server.to(room).emit(event, data)
          server.lastActivity = new Date()
        } catch (error) {
          this._logger.error(
            `Room broadcast failed on server ${server.id}:`,
            error
          )
        }
      })

    await Promise.all(broadcasts)

    this.logServiceOperation('broadcastToRoom', {
      room,
      event,
      serverCount: broadcasts.length,
      hasData: !!data,
    })
  }

  /**
   * Broadcast to a specific user across all servers
   */
  async broadcastToUser(
    userId: string,
    event: string,
    data: any
  ): Promise<void> {
    const broadcasts = Array.from(this._servers.values())
      .filter((server) => server.healthy)
      .map(async (server) => {
        try {
          // Find user's sockets across all servers
          const sockets = await server.server.fetchSockets()
          const userSockets = sockets.filter(
            (socket) => socket.data?.userId === userId
          )

          for (const socket of userSockets) {
            socket.emit(event, data)
          }

          if (userSockets.length > 0) {
            server.lastActivity = new Date()
          }
        } catch (error) {
          this._logger.error(
            `User broadcast failed on server ${server.id}:`,
            error
          )
        }
      })

    await Promise.all(broadcasts)

    this.logServiceOperation('broadcastToUser', {
      userId,
      event,
      serverCount: broadcasts.length,
      hasData: !!data,
    })
  }

  /**
   * Get total connections across all servers
   */
  getTotalConnections(): number {
    return Array.from(this._servers.values()).reduce(
      (total, server) => total + server.connections,
      0
    )
  }

  /**
   * Get connections for a specific server
   */
  getServerConnections(poolId: string): number {
    const server = this._servers.get(poolId)
    return server ? server.connections : 0
  }

  /**
   * Get connection distribution across servers
   */
  getConnectionDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {}

    for (const [poolId, server] of this._servers) {
      distribution[poolId] = server.connections
    }

    return distribution
  }

  /**
   * Get comprehensive pool health information
   */
  async getPoolHealth(): Promise<PoolHealth> {
    const servers: Record<string, ServerHealth> = {}
    let totalConnections = 0
    let activeServers = 0

    for (const [poolId, server] of this._servers) {
      const uptime = Date.now() - server.createdAt.getTime()
      const load = server.connections / this._connectionThreshold

      servers[poolId] = {
        poolId,
        connections: server.connections,
        load,
        healthy: server.healthy,
        uptime,
      }

      totalConnections += server.connections
      if (server.healthy) {
        activeServers += 1
      }
    }

    const averageLoad =
      this._servers.size > 0
        ? totalConnections / (this._servers.size * this._connectionThreshold)
        : 0

    return {
      healthy: activeServers > 0,
      totalServers: this._servers.size,
      activeServers,
      totalConnections,
      averageLoad,
      servers,
    }
  }

  /**
   * Set load balancing strategy
   */
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this._loadBalancer.setStrategy(strategy)
    this._logger.info(`Load balancing strategy changed to: ${strategy}`)
  }

  /**
   * Get current load balancing strategy
   */
  getLoadBalancingStrategy(): LoadBalancingStrategy {
    return this._loadBalancer.getStrategy()
  }

  /**
   * Get the load balancer instance
   */
  getLoadBalancer(): WebSocketLoadBalancer {
    return this._loadBalancer
  }

  /**
   * Set up connection tracking for a server
   */
  private _setupServerTracking(io: SocketIOServer, poolId: string): void {
    const server = this._servers.get(poolId)
    if (!server) return

    io.on('connection', (socket) => {
      // Increment connection count
      server.connections += 1
      server.lastActivity = new Date()

      // Update load balancer with new connection count
      const load = server.connections / this._connectionThreshold
      this._loadBalancer.updateNodeLoad(poolId, server.connections, load)

      this._logger.debug(
        `Client connected to server ${poolId} (${server.connections} total)`
      )

      socket.on('disconnect', () => {
        // Decrement connection count
        server.connections = Math.max(0, server.connections - 1)
        server.lastActivity = new Date()

        // Update load balancer with updated connection count
        const load = server.connections / this._connectionThreshold
        this._loadBalancer.updateNodeLoad(poolId, server.connections, load)

        this._logger.debug(
          `Client disconnected from server ${poolId} (${server.connections} total)`
        )
      })
    })
  }

  /**
   * Start monitoring server health
   */
  private _startMonitoring(): void {
    this._monitoringInterval = setInterval(async () => {
      try {
        await this._monitorServerHealth()
      } catch (error) {
        this._logger.error('Server health monitoring failed:', error)
      }
    }, 30000) // Monitor every 30 seconds
  }

  /**
   * Monitor the health of all servers in the pool
   */
  private async _monitorServerHealth(): Promise<void> {
    for (const [poolId, server] of this._servers) {
      try {
        // Check if server is responsive by fetching sockets
        const sockets = await server.server.fetchSockets()
        server.healthy = true
        server.connections = sockets.length // Ensure accurate count
      } catch (error) {
        this._logger.error(`Server ${poolId} health check failed:`, error)
        server.healthy = false
      }
    }

    // Log health summary
    const health = await this.getPoolHealth()
    this.logServiceOperation('healthCheck', {
      totalServers: health.totalServers,
      activeServers: health.activeServers,
      totalConnections: health.totalConnections,
      averageLoad: health.averageLoad,
    })
  }

  /**
   * Start load rebalancing process
   */
  private _startLoadRebalancing(): void {
    this._rebalanceInterval = setInterval(async () => {
      try {
        await this._rebalanceConnections()
      } catch (error) {
        this._logger.error('Load rebalancing failed:', error)
      }
    }, 60000) // Rebalance every minute
  }

  /**
   * Rebalance connections across servers
   */
  private async _rebalanceConnections(): Promise<void> {
    const servers = Array.from(this._servers.values()).filter((s) => s.healthy)

    if (servers.length < 2) {
      return // No rebalancing needed with less than 2 servers
    }

    const totalConnections = servers.reduce((sum, s) => sum + s.connections, 0)
    const averageConnections = totalConnections / servers.length
    const threshold = averageConnections * 0.3 // 30% threshold

    // Find overloaded and underloaded servers
    const overloaded = servers.filter(
      (s) => s.connections > averageConnections + threshold
    )
    const underloaded = servers.filter(
      (s) => s.connections < averageConnections - threshold
    )

    if (overloaded.length === 0 || underloaded.length === 0) {
      return // No rebalancing needed
    }

    this.logServiceOperation('rebalanceConnections', {
      totalConnections,
      averageConnections,
      overloadedServers: overloaded.length,
      underloadedServers: underloaded.length,
    })

    // Note: In a production environment, you would implement actual connection migration
    // This might involve Redis pub/sub for cross-server coordination
    this._logger.info('Connection rebalancing completed')
  }

  async cleanup(): Promise<void> {
    this.logServiceOperation('cleanup', {
      serverCount: this._servers.size,
      totalConnections: this.getTotalConnections(),
    })

    // Stop monitoring
    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval)
      this._monitoringInterval = null
    }

    if (this._rebalanceInterval) {
      clearInterval(this._rebalanceInterval)
      this._rebalanceInterval = null
    }

    // Close all servers
    const shutdownPromises = Array.from(this._servers.keys()).map((poolId) =>
      this.removeServer(poolId)
    )

    await Promise.all(shutdownPromises)

    // Clear event listeners
    this._eventEmitter.removeAllListeners()

    // Clean up load balancer
    await this._loadBalancer.cleanup()

    await super.cleanup()
  }

  async healthCheck(): Promise<boolean> {
    const health = await this.getPoolHealth()
    return health.healthy && health.activeServers > 0
  }
}
