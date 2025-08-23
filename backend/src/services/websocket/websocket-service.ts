import { Server as SocketIOServer } from 'socket.io'
import { EventEmitter } from 'events'
import { BaseService } from '../base/service'
import { WebSocketBroadcast, ServiceContext, ServiceError } from '../types'
import { WebSocketPool } from './websocket-pool'
import http from 'http'

/**
 * WebSocket Service Interface
 * Manages real-time communication via Socket.IO
 */
export interface IWebSocketService {
  // Server management
  attachSocketServer(io: SocketIOServer): void
  attachHttpServer(
    server: http.Server,
    options?: Record<string, any>
  ): Promise<string>
  getSocketServer(): SocketIOServer | null
  getConnectionPool(): WebSocketPool

  // Broadcasting
  broadcastToConversation(broadcast: WebSocketBroadcast): Promise<void>
  broadcastToUser(userId: string, event: string, data: any): Promise<void>
  broadcastToAll(event: string, data: any): Promise<void>

  // Connection management
  getConnectedUsers(): string[]
  getUserSocketCount(userId: string): number
  isUserConnected(userId: string): boolean

  // Room management
  joinRoom(socketId: string, room: string): Promise<void>
  leaveRoom(socketId: string, room: string): Promise<void>
  getRoomMembers(room: string): string[]

  // Event management for tRPC integration
  getEventEmitter(): EventEmitter
  emitRealtimeEvent(event: string, data: any): void
  subscribeToEvents(callback: (event: string, data: any) => void): () => void

  // Streaming support
  startMessageStream(conversationId: string, messageId: string): void
  streamMessageContent(
    conversationId: string,
    messageId: string,
    content: string,
    isComplete: boolean
  ): void
  endMessageStream(conversationId: string, messageId: string): void
}

/**
 * WebSocket Service Implementation
 * Provides real-time communication capabilities for the service layer
 */
export class WebSocketService extends BaseService implements IWebSocketService {
  private _io: SocketIOServer | null = null
  private _connectionPool: WebSocketPool
  private _userSocketMap = new Map<string, Set<string>>() // userId -> Set<socketId>
  private _socketUserMap = new Map<string, string>() // socketId -> userId
  private _eventEmitter = new EventEmitter()
  private _activeStreams = new Map<
    string,
    { conversationId: string; messageId: string; startTime: Date }
  >()
  private _useConnectionPooling = false

  constructor(options?: { useConnectionPooling?: boolean }) {
    super('websocket-service')
    this._useConnectionPooling = options?.useConnectionPooling ?? false
    this._connectionPool = new WebSocketPool({
      maxServersPerPool: 3,
      connectionThreshold: 500,
    })
  }

  async initialize(): Promise<void> {
    this._logger.info('Initializing WebSocket Service...')

    // Set up event emitter for tRPC integration
    this._eventEmitter.setMaxListeners(100) // Support many concurrent subscriptions

    // Initialize connection pool if enabled
    if (this._useConnectionPooling) {
      await this._connectionPool.initialize()
      this._logger.info('✅ WebSocket connection pool initialized')
    }

    // Service is initialized when Socket.IO server is attached
    this._logger.info(
      '✅ WebSocket Service initialized with event emission support'
    )
  }

  /**
   * Attach Socket.IO server instance (legacy method)
   */
  attachSocketServer(io: SocketIOServer): void {
    if (this._io) {
      this._logger.warn('Socket.IO server already attached - replacing')
    }

    this._io = io
    this._setupEventHandlers()
    this._logger.info('Socket.IO server attached to WebSocket service')
  }

  /**
   * Attach HTTP server for connection pooling
   */
  async attachHttpServer(
    server: http.Server,
    options?: Record<string, any>
  ): Promise<string> {
    if (!this._useConnectionPooling) {
      throw new ServiceError(
        'Connection pooling not enabled',
        'POOLING_DISABLED',
        this.name
      )
    }

    try {
      const poolId = await this._connectionPool.addServer(server, options)
      this._logger.info(`HTTP server attached to connection pool: ${poolId}`)
      return poolId
    } catch (error) {
      this.logServiceError('attachHttpServer', error as Error)
      throw error
    }
  }

  /**
   * Get the Socket.IO server instance
   */
  getSocketServer(): SocketIOServer | null {
    if (this._useConnectionPooling) {
      return this._connectionPool.getOptimalServer()
    }
    return this._io
  }

  /**
   * Get the connection pool instance
   */
  getConnectionPool(): WebSocketPool {
    return this._connectionPool
  }

  /**
   * Broadcast message to all clients in a conversation room
   */
  async broadcastToConversation(broadcast: WebSocketBroadcast): Promise<void> {
    this.logServiceOperation('broadcastToConversation', {
      room: broadcast.room,
      event: broadcast.event,
      excludeSocketId: broadcast.excludeSocketId,
      usePooling: this._useConnectionPooling,
    })

    try {
      if (this._useConnectionPooling) {
        // Use connection pool for broadcasting
        await this._connectionPool.broadcastToRoom(
          broadcast.room,
          broadcast.event,
          broadcast.data
        )
      } else {
        // Use single server instance
        if (!this._io) {
          throw new ServiceError(
            'Socket.IO server not attached',
            'NO_WEBSOCKET_SERVER',
            this.name
          )
        }

        let emitter = this._io.to(broadcast.room)

        if (broadcast.excludeSocketId) {
          emitter = emitter.except(broadcast.excludeSocketId)
        }

        emitter.emit(broadcast.event, broadcast.data)
      }

      this._logger.debug(
        `Broadcast sent to room ${broadcast.room}: ${broadcast.event}`
      )
    } catch (error) {
      this.logServiceError('broadcastToConversation', error as Error)
      throw new ServiceError(
        'Failed to broadcast to conversation',
        'BROADCAST_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Broadcast message to a specific user (all their connected sockets)
   */
  async broadcastToUser(
    userId: string,
    event: string,
    data: any
  ): Promise<void> {
    this.logServiceOperation('broadcastToUser', {
      userId,
      event,
      usePooling: this._useConnectionPooling,
    })

    try {
      if (this._useConnectionPooling) {
        // Use connection pool for user broadcasting
        await this._connectionPool.broadcastToUser(userId, event, data)
      } else {
        // Use single server instance
        if (!this._io) {
          throw new ServiceError(
            'Socket.IO server not attached',
            'NO_WEBSOCKET_SERVER',
            this.name
          )
        }

        const userSockets = this._userSocketMap.get(userId)

        if (!userSockets || userSockets.size === 0) {
          this._logger.debug(
            `User ${userId} not connected - skipping broadcast`
          )
          return
        }

        // Broadcast to each socket for this user
        for (const socketId of userSockets) {
          this._io.to(socketId).emit(event, data)
        }
      }

      this._logger.debug(`Broadcast sent to user ${userId}: ${event}`)
    } catch (error) {
      this.logServiceError('broadcastToUser', error as Error)
      throw new ServiceError(
        'Failed to broadcast to user',
        'BROADCAST_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  async broadcastToAll(event: string, data: any): Promise<void> {
    this.logServiceOperation('broadcastToAll', {
      event,
      usePooling: this._useConnectionPooling,
    })

    try {
      if (this._useConnectionPooling) {
        // Use connection pool for global broadcasting
        await this._connectionPool.broadcastToAll(event, data)
      } else {
        // Use single server instance
        if (!this._io) {
          throw new ServiceError(
            'Socket.IO server not attached',
            'NO_WEBSOCKET_SERVER',
            this.name
          )
        }

        this._io.emit(event, data)
      }

      this._logger.debug(`Global broadcast sent: ${event}`)
    } catch (error) {
      this.logServiceError('broadcastToAll', error as Error)
      throw new ServiceError(
        'Failed to broadcast to all',
        'BROADCAST_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Get list of connected user IDs
   */
  getConnectedUsers(): string[] {
    if (this._useConnectionPooling) {
      // Note: In pooled mode, user tracking would need to be centralized (e.g., Redis)
      this._logger.debug(
        'User tracking in pooled mode requires centralized storage'
      )
      return []
    }
    return Array.from(this._userSocketMap.keys())
  }

  /**
   * Get socket count for a specific user
   */
  getUserSocketCount(userId: string): number {
    if (this._useConnectionPooling) {
      // Note: In pooled mode, user tracking would need to be centralized
      this._logger.debug(
        'User socket count tracking in pooled mode requires centralized storage'
      )
      return 0
    }
    const userSockets = this._userSocketMap.get(userId)
    return userSockets ? userSockets.size : 0
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    if (this._useConnectionPooling) {
      // Note: In pooled mode, user tracking would need to be centralized
      this._logger.debug(
        'User connection check in pooled mode requires centralized storage'
      )
      return false
    }
    const userSockets = this._userSocketMap.get(userId)
    return userSockets !== undefined && userSockets.size > 0
  }

  /**
   * Join a socket to a room
   */
  async joinRoom(socketId: string, room: string): Promise<void> {
    if (!this._io) {
      throw new ServiceError(
        'Socket.IO server not attached',
        'NO_WEBSOCKET_SERVER',
        this.name
      )
    }

    try {
      const socket = this._io.sockets.sockets.get(socketId)
      if (socket) {
        await socket.join(room)
        this._logger.debug(`Socket ${socketId} joined room ${room}`)
      } else {
        this._logger.warn(`Socket ${socketId} not found for room join`)
      }
    } catch (error) {
      this.logServiceError('joinRoom', error as Error)
      throw new ServiceError(
        'Failed to join room',
        'JOIN_ROOM_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Remove a socket from a room
   */
  async leaveRoom(socketId: string, room: string): Promise<void> {
    if (!this._io) {
      throw new ServiceError(
        'Socket.IO server not attached',
        'NO_WEBSOCKET_SERVER',
        this.name
      )
    }

    try {
      const socket = this._io.sockets.sockets.get(socketId)
      if (socket) {
        await socket.leave(room)
        this._logger.debug(`Socket ${socketId} left room ${room}`)
      } else {
        this._logger.warn(`Socket ${socketId} not found for room leave`)
      }
    } catch (error) {
      this.logServiceError('leaveRoom', error as Error)
      throw new ServiceError(
        'Failed to leave room',
        'LEAVE_ROOM_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Get list of socket IDs in a room
   */
  getRoomMembers(room: string): string[] {
    if (!this._io) {
      return []
    }

    const roomSockets = this._io.sockets.adapter.rooms.get(room)
    return roomSockets ? Array.from(roomSockets) : []
  }

  /**
   * Get event emitter for tRPC subscription integration
   */
  getEventEmitter(): EventEmitter {
    return this._eventEmitter
  }

  /**
   * Emit realtime event for tRPC subscriptions
   */
  emitRealtimeEvent(event: string, data: any): void {
    this.logServiceOperation('emitRealtimeEvent', { event, hasData: !!data })
    this._eventEmitter.emit(event, data)
  }

  /**
   * Subscribe to events with callback
   */
  subscribeToEvents(callback: (event: string, data: any) => void): () => void {
    const listener = (data: any) => {
      callback('realtime-event', data)
    }

    this._eventEmitter.on('realtime-event', listener)

    // Return cleanup function
    return () => {
      this._eventEmitter.off('realtime-event', listener)
    }
  }

  /**
   * Start message streaming session
   */
  startMessageStream(conversationId: string, messageId: string): void {
    const streamKey = `${conversationId}:${messageId}`

    this._activeStreams.set(streamKey, {
      conversationId,
      messageId,
      startTime: new Date(),
    })

    this.logServiceOperation('startMessageStream', {
      conversationId,
      messageId,
    })

    // Emit stream start event for tRPC subscriptions
    this.emitRealtimeEvent('messageStreamStarted', {
      conversationId,
      messageId,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Stream message content chunk
   */
  streamMessageContent(
    conversationId: string,
    messageId: string,
    content: string,
    isComplete: boolean
  ): void {
    const streamKey = `${conversationId}:${messageId}`

    if (!this._activeStreams.has(streamKey)) {
      this._logger.warn(`Streaming content for inactive stream: ${streamKey}`)
      return
    }

    // Broadcast to WebSocket clients
    if (this._io) {
      this._io.to(conversationId).emit('messageStreaming', {
        conversationId,
        messageId,
        content,
        isComplete,
        timestamp: new Date().toISOString(),
      })
    }

    // Emit for tRPC subscriptions
    this.emitRealtimeEvent('messageStreaming', {
      conversationId,
      messageId,
      content,
      isComplete,
      timestamp: new Date().toISOString(),
    })

    if (isComplete) {
      this.endMessageStream(conversationId, messageId)
    }
  }

  /**
   * End message streaming session
   */
  endMessageStream(conversationId: string, messageId: string): void {
    const streamKey = `${conversationId}:${messageId}`
    const streamInfo = this._activeStreams.get(streamKey)

    if (streamInfo) {
      const duration = Date.now() - streamInfo.startTime.getTime()

      this.logServiceOperation('endMessageStream', {
        conversationId,
        messageId,
        duration,
      })

      this._activeStreams.delete(streamKey)

      // Emit stream end event for tRPC subscriptions
      this.emitRealtimeEvent('messageStreamEnded', {
        conversationId,
        messageId,
        duration,
        timestamp: new Date().toISOString(),
      })
    }
  }

  /**
   * Setup Socket.IO event handlers for connection tracking
   */
  private _setupEventHandlers(): void {
    if (!this._io) return

    this._io.on('connection', (socket) => {
      const userId = socket.data?.userId

      if (userId) {
        this._addUserSocket(userId, socket.id)
        this.logServiceOperation('socketConnected', {
          socketId: socket.id,
          userId,
          totalSockets: this._socketUserMap.size,
        })
      }

      socket.on('disconnect', () => {
        if (userId) {
          this._removeUserSocket(userId, socket.id)
          this.logServiceOperation('socketDisconnected', {
            socketId: socket.id,
            userId,
            totalSockets: this._socketUserMap.size,
          })
        }
      })
    })

    this._logger.info('Socket.IO event handlers configured')
  }

  /**
   * Track user socket connection
   */
  private _addUserSocket(userId: string, socketId: string): void {
    // Add to user -> sockets mapping
    if (!this._userSocketMap.has(userId)) {
      this._userSocketMap.set(userId, new Set())
    }
    this._userSocketMap.get(userId)!.add(socketId)

    // Add to socket -> user mapping
    this._socketUserMap.set(socketId, userId)
  }

  /**
   * Remove user socket connection
   */
  private _removeUserSocket(userId: string, socketId: string): void {
    // Remove from user -> sockets mapping
    const userSockets = this._userSocketMap.get(userId)
    if (userSockets) {
      userSockets.delete(socketId)
      if (userSockets.size === 0) {
        this._userSocketMap.delete(userId)
      }
    }

    // Remove from socket -> user mapping
    this._socketUserMap.delete(socketId)
  }

  async cleanup(): Promise<void> {
    this.logServiceOperation('cleanup', {
      connectedUsers: this._userSocketMap.size,
      connectedSockets: this._socketUserMap.size,
      activeStreams: this._activeStreams.size,
      usePooling: this._useConnectionPooling,
    })

    // Clear tracking maps
    this._userSocketMap.clear()
    this._socketUserMap.clear()
    this._activeStreams.clear()

    // Clear event listeners
    this._eventEmitter.removeAllListeners()

    // Clean up connection pool
    if (this._useConnectionPooling) {
      await this._connectionPool.cleanup()
    }

    // Note: Don't close the Socket.IO server here as it's managed externally
    this._io = null

    await super.cleanup()
  }

  async healthCheck(): Promise<boolean> {
    if (this._useConnectionPooling) {
      return await this._connectionPool.healthCheck()
    }
    return this._io !== null
  }
}
