import { EventEmitter } from 'events'
import { BaseService } from '../base/service'
import { ServiceError } from '../types'

/**
 * Load Balancing Strategy Types
 */
export type LoadBalancingStrategy =
  | 'round-robin'
  | 'least-connections'
  | 'weighted-round-robin'
  | 'hash-based'

/**
 * Server Node Interface
 */
export interface ServerNode {
  id: string
  weight: number
  connections: number
  load: number
  healthy: boolean
  lastHealthCheck: Date
  responseTime: number
  metadata: Record<string, any>
}

/**
 * Load Balancer Configuration
 */
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy
  healthCheckInterval: number
  maxResponseTime: number
  maxConnections: number
  enableStickySessions: boolean
  hashFunction?: (request: any) => string
}

/**
 * WebSocket Load Balancer Interface
 */
export interface IWebSocketLoadBalancer {
  // Node management
  addNode(node: Omit<ServerNode, 'lastHealthCheck'>): Promise<void>
  removeNode(nodeId: string): Promise<void>
  updateNodeLoad(nodeId: string, connections: number, load: number): void
  getNodeHealth(): Record<string, ServerNode>

  // Load balancing
  selectNode(request?: any): ServerNode | null
  rebalanceNodes(): Promise<void>

  // Configuration
  setStrategy(strategy: LoadBalancingStrategy): void
  getStrategy(): LoadBalancingStrategy

  // Monitoring
  getLoadDistribution(): Record<string, number>
  getBalancerStats(): LoadBalancerStats
}

interface LoadBalancerStats {
  totalNodes: number
  healthyNodes: number
  totalConnections: number
  averageLoad: number
  strategy: LoadBalancingStrategy
  rebalanceCount: number
  lastRebalance: Date | null
}

/**
 * WebSocket Load Balancer Implementation
 * Provides intelligent load distribution across WebSocket server instances
 */
export class WebSocketLoadBalancer
  extends BaseService
  implements IWebSocketLoadBalancer
{
  private _nodes = new Map<string, ServerNode>()
  private _eventEmitter = new EventEmitter()
  private _config: LoadBalancerConfig
  private _roundRobinIndex = 0
  private _rebalanceCount = 0
  private _lastRebalance: Date | null = null
  private _healthCheckInterval: NodeJS.Timeout | null = null
  private _rebalanceInterval: NodeJS.Timeout | null = null
  private _stickySessionMap = new Map<string, string>() // sessionId -> nodeId

  constructor(config: Partial<LoadBalancerConfig> = {}) {
    super('websocket-load-balancer')

    this._config = {
      strategy: config.strategy || 'least-connections',
      healthCheckInterval: config.healthCheckInterval || 30000,
      maxResponseTime: config.maxResponseTime || 5000,
      maxConnections: config.maxConnections || 1000,
      enableStickySessions: config.enableStickySessions || false,
      hashFunction: config.hashFunction,
    }
  }

  async initialize(): Promise<void> {
    this._logger.info('Initializing WebSocket Load Balancer...')

    // Set up event emitter
    this._eventEmitter.setMaxListeners(50)

    // Start health checking
    this._startHealthChecking()

    // Start automatic rebalancing
    this._startAutoRebalancing()

    this._logger.info(
      `✅ WebSocket Load Balancer initialized with strategy: ${this._config.strategy}`
    )
  }

  /**
   * Add a server node to the load balancer
   */
  async addNode(node: Omit<ServerNode, 'lastHealthCheck'>): Promise<void> {
    if (this._nodes.has(node.id)) {
      throw new ServiceError(
        `Node ${node.id} already exists`,
        'NODE_EXISTS',
        this.name
      )
    }

    const serverNode: ServerNode = {
      ...node,
      lastHealthCheck: new Date(),
    }

    this._nodes.set(node.id, serverNode)

    this.logServiceOperation('addNode', {
      nodeId: node.id,
      weight: node.weight,
      totalNodes: this._nodes.size,
    })

    this._logger.info(`✅ Added server node ${node.id} to load balancer`)

    // Emit node change event
    this._eventEmitter.emit('nodeAdded', {
      nodeId: node.id,
      totalNodes: this._nodes.size,
    })
  }

  /**
   * Remove a server node from the load balancer
   */
  async removeNode(nodeId: string): Promise<void> {
    const node = this._nodes.get(nodeId)
    if (!node) {
      this._logger.warn(`Node ${nodeId} not found in load balancer`)
      return
    }

    // Remove sticky sessions for this node
    if (this._config.enableStickySessions) {
      for (const [sessionId, assignedNodeId] of this._stickySessionMap) {
        if (assignedNodeId === nodeId) {
          this._stickySessionMap.delete(sessionId)
        }
      }
    }

    this._nodes.delete(nodeId)

    this.logServiceOperation('removeNode', {
      nodeId,
      totalNodes: this._nodes.size,
      connectionsLost: node.connections,
    })

    this._logger.info(`✅ Removed server node ${nodeId} from load balancer`)

    // Emit node change event
    this._eventEmitter.emit('nodeRemoved', {
      nodeId,
      totalNodes: this._nodes.size,
    })

    // Trigger rebalancing if nodes remain
    if (this._nodes.size > 0) {
      await this.rebalanceNodes()
    }
  }

  /**
   * Update node load metrics
   */
  updateNodeLoad(nodeId: string, connections: number, load: number): void {
    const node = this._nodes.get(nodeId)
    if (!node) {
      this._logger.warn(`Cannot update load for unknown node: ${nodeId}`)
      return
    }

    node.connections = connections
    node.load = load
    node.lastHealthCheck = new Date()

    // Update health status based on connections and load
    node.healthy = connections < this._config.maxConnections && load < 0.9

    this.logServiceOperation('updateNodeLoad', {
      nodeId,
      connections,
      load,
      healthy: node.healthy,
    })
  }

  /**
   * Get health information for all nodes
   */
  getNodeHealth(): Record<string, ServerNode> {
    const health: Record<string, ServerNode> = {}

    for (const [nodeId, node] of this._nodes) {
      health[nodeId] = { ...node }
    }

    return health
  }

  /**
   * Select the optimal server node based on the configured strategy
   */
  selectNode(request?: any): ServerNode | null {
    const healthyNodes = Array.from(this._nodes.values()).filter(
      (node) => node.healthy
    )

    if (healthyNodes.length === 0) {
      this._logger.warn('No healthy nodes available for selection')
      return null
    }

    let selectedNode: ServerNode | null = null

    // Check for sticky session first if enabled
    if (this._config.enableStickySessions && request?.sessionId) {
      const stickyNodeId = this._stickySessionMap.get(request.sessionId)
      if (stickyNodeId) {
        const stickyNode = this._nodes.get(stickyNodeId)
        if (stickyNode && stickyNode.healthy) {
          selectedNode = stickyNode
        }
      }
    }

    // Apply load balancing strategy if no sticky session or sticky node is unhealthy
    if (!selectedNode) {
      selectedNode = this._applyStrategy(healthyNodes, request)

      // Create sticky session mapping if enabled
      if (
        this._config.enableStickySessions &&
        request?.sessionId &&
        selectedNode
      ) {
        this._stickySessionMap.set(request.sessionId, selectedNode.id)
      }
    }

    if (selectedNode) {
      this.logServiceOperation('selectNode', {
        selectedNodeId: selectedNode.id,
        strategy: this._config.strategy,
        healthyNodes: healthyNodes.length,
        nodeConnections: selectedNode.connections,
        nodeLoad: selectedNode.load,
      })
    }

    return selectedNode
  }

  /**
   * Apply the configured load balancing strategy
   */
  private _applyStrategy(
    healthyNodes: ServerNode[],
    request?: any
  ): ServerNode | null {
    switch (this._config.strategy) {
      case 'round-robin':
        return this._roundRobinSelection(healthyNodes)

      case 'least-connections':
        return this._leastConnectionsSelection(healthyNodes)

      case 'weighted-round-robin':
        return this._weightedRoundRobinSelection(healthyNodes)

      case 'hash-based':
        return this._hashBasedSelection(healthyNodes, request)

      default:
        this._logger.warn(
          `Unknown strategy: ${this._config.strategy}, falling back to round-robin`
        )
        return this._roundRobinSelection(healthyNodes)
    }
  }

  /**
   * Round-robin node selection
   */
  private _roundRobinSelection(nodes: ServerNode[]): ServerNode {
    const selectedNode = nodes[this._roundRobinIndex % nodes.length]
    this._roundRobinIndex = (this._roundRobinIndex + 1) % nodes.length
    return selectedNode
  }

  /**
   * Least connections node selection
   */
  private _leastConnectionsSelection(nodes: ServerNode[]): ServerNode {
    return nodes.reduce((least, current) =>
      current.connections < least.connections ? current : least
    )
  }

  /**
   * Weighted round-robin node selection
   */
  private _weightedRoundRobinSelection(nodes: ServerNode[]): ServerNode {
    // Calculate total weight
    const totalWeight = nodes.reduce((sum, node) => sum + node.weight, 0)

    if (totalWeight === 0) {
      return this._roundRobinSelection(nodes)
    }

    // Generate weighted selection
    const weightedNodes: ServerNode[] = []
    for (const node of nodes) {
      const repetitions = Math.ceil((node.weight / totalWeight) * 10)
      for (let i = 0; i < repetitions; i++) {
        weightedNodes.push(node)
      }
    }

    return this._roundRobinSelection(weightedNodes)
  }

  /**
   * Hash-based node selection (consistent hashing)
   */
  private _hashBasedSelection(nodes: ServerNode[], request?: any): ServerNode {
    if (!this._config.hashFunction || !request) {
      return this._roundRobinSelection(nodes)
    }

    try {
      const hash = this._config.hashFunction(request)
      const hashNumber = this._simpleHash(hash)
      const selectedIndex = hashNumber % nodes.length
      return nodes[selectedIndex]
    } catch (error) {
      this._logger.error('Hash-based selection failed:', error)
      return this._roundRobinSelection(nodes)
    }
  }

  /**
   * Simple hash function for consistent node selection
   */
  private _simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Rebalance nodes by redistributing load
   */
  async rebalanceNodes(): Promise<void> {
    const nodes = Array.from(this._nodes.values()).filter(
      (node) => node.healthy
    )

    if (nodes.length < 2) {
      return // No rebalancing needed with less than 2 nodes
    }

    const totalConnections = nodes.reduce(
      (sum, node) => sum + node.connections,
      0
    )
    const averageConnections = totalConnections / nodes.length
    const threshold = averageConnections * 0.2 // 20% threshold

    // Find overloaded and underloaded nodes
    const overloaded = nodes.filter(
      (node) => node.connections > averageConnections + threshold
    )
    const underloaded = nodes.filter(
      (node) => node.connections < averageConnections - threshold
    )

    if (overloaded.length === 0 || underloaded.length === 0) {
      return // No rebalancing needed
    }

    this._rebalanceCount += 1
    this._lastRebalance = new Date()

    this.logServiceOperation('rebalanceNodes', {
      totalNodes: nodes.length,
      totalConnections,
      averageConnections,
      overloadedNodes: overloaded.length,
      underloadedNodes: underloaded.length,
      rebalanceCount: this._rebalanceCount,
    })

    // Emit rebalance event
    this._eventEmitter.emit('rebalanceCompleted', {
      rebalanceCount: this._rebalanceCount,
      nodesRebalanced: overloaded.length + underloaded.length,
    })

    this._logger.info(
      `✅ Load rebalancing completed (${this._rebalanceCount} times)`
    )
  }

  /**
   * Set the load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this._config.strategy = strategy
    this._roundRobinIndex = 0 // Reset round-robin counter

    this.logServiceOperation('setStrategy', { strategy })
    this._logger.info(`Load balancing strategy changed to: ${strategy}`)
  }

  /**
   * Get the current load balancing strategy
   */
  getStrategy(): LoadBalancingStrategy {
    return this._config.strategy
  }

  /**
   * Get load distribution across all nodes
   */
  getLoadDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {}

    for (const [nodeId, node] of this._nodes) {
      distribution[nodeId] = node.connections
    }

    return distribution
  }

  /**
   * Get comprehensive load balancer statistics
   */
  getBalancerStats(): LoadBalancerStats {
    const nodes = Array.from(this._nodes.values())
    const healthyNodes = nodes.filter((node) => node.healthy)
    const totalConnections = nodes.reduce(
      (sum, node) => sum + node.connections,
      0
    )
    const averageLoad = nodes.length > 0 ? totalConnections / nodes.length : 0

    return {
      totalNodes: this._nodes.size,
      healthyNodes: healthyNodes.length,
      totalConnections,
      averageLoad,
      strategy: this._config.strategy,
      rebalanceCount: this._rebalanceCount,
      lastRebalance: this._lastRebalance,
    }
  }

  /**
   * Start health checking for all nodes
   */
  private _startHealthChecking(): void {
    this._healthCheckInterval = setInterval(() => {
      this._performHealthChecks()
    }, this._config.healthCheckInterval)
  }

  /**
   * Perform health checks on all nodes
   */
  private _performHealthChecks(): void {
    const now = new Date()

    for (const [nodeId, node] of this._nodes) {
      const timeSinceLastCheck = now.getTime() - node.lastHealthCheck.getTime()

      // Mark node as unhealthy if no update for too long
      if (timeSinceLastCheck > this._config.healthCheckInterval * 2) {
        node.healthy = false
        this._logger.warn(
          `Node ${nodeId} marked unhealthy due to no recent updates`
        )
      }

      // Check response time and connection limits
      if (node.responseTime > this._config.maxResponseTime) {
        node.healthy = false
        this._logger.warn(
          `Node ${nodeId} marked unhealthy due to high response time`
        )
      }

      if (node.connections > this._config.maxConnections) {
        node.healthy = false
        this._logger.warn(
          `Node ${nodeId} marked unhealthy due to too many connections`
        )
      }
    }

    // Log health check summary
    const healthyCount = Array.from(this._nodes.values()).filter(
      (n) => n.healthy
    ).length
    this.logServiceOperation('healthCheck', {
      totalNodes: this._nodes.size,
      healthyNodes: healthyCount,
      unhealthyNodes: this._nodes.size - healthyCount,
    })
  }

  /**
   * Start automatic rebalancing
   */
  private _startAutoRebalancing(): void {
    this._rebalanceInterval = setInterval(async () => {
      try {
        await this.rebalanceNodes()
      } catch (error) {
        this._logger.error('Automatic rebalancing failed:', error)
      }
    }, 120000) // Rebalance every 2 minutes
  }

  async cleanup(): Promise<void> {
    this.logServiceOperation('cleanup', {
      totalNodes: this._nodes.size,
      rebalanceCount: this._rebalanceCount,
      stickySessionCount: this._stickySessionMap.size,
    })

    // Stop intervals
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval)
      this._healthCheckInterval = null
    }

    if (this._rebalanceInterval) {
      clearInterval(this._rebalanceInterval)
      this._rebalanceInterval = null
    }

    // Clear data structures
    this._nodes.clear()
    this._stickySessionMap.clear()
    this._eventEmitter.removeAllListeners()

    await super.cleanup()
  }

  async healthCheck(): Promise<boolean> {
    const healthyNodes = Array.from(this._nodes.values()).filter(
      (node) => node.healthy
    )
    return healthyNodes.length > 0
  }
}
