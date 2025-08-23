import { Server as SocketIOServer } from 'socket.io'
import { BaseService } from '../base/service'
import { WebSocketBroadcast, ServiceContext, ServiceError } from '../types'

/**
 * WebSocket Service Interface
 * Manages real-time communication via Socket.IO
 */
export interface IWebSocketService {
  // Server management
  attachSocketServer(io: SocketIOServer): void
  getSocketServer(): SocketIOServer | null

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
}

/**
 * WebSocket Service Implementation
 * Provides real-time communication capabilities for the service layer
 */
export class WebSocketService extends BaseService implements IWebSocketService {
  private _io: SocketIOServer | null = null
  private _userSocketMap = new Map<string, Set<string>>() // userId -> Set<socketId>
  private _socketUserMap = new Map<string, string>() // socketId -> userId

  constructor() {
    super('websocket-service')
  }

  async initialize(): Promise<void> {
    this._logger.info('Initializing WebSocket Service...')
    // Service is initialized when Socket.IO server is attached
    this._logger.info('✅ WebSocket Service initialized')
  }

  /**
   * Attach Socket.IO server instance
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
   * Get the Socket.IO server instance
   */
  getSocketServer(): SocketIOServer | null {
    return this._io
  }

  /**
   * Broadcast message to all clients in a conversation room
   */
  async broadcastToConversation(broadcast: WebSocketBroadcast): Promise<void> {
    if (!this._io) {
      throw new ServiceError(
        'Socket.IO server not attached',
        'NO_WEBSOCKET_SERVER',
        this.name
      )
    }

    this.logServiceOperation('broadcastToConversation', {
      room: broadcast.room,
      event: broadcast.event,
      excludeSocketId: broadcast.excludeSocketId,
    })

    try {
      let emitter = this._io.to(broadcast.room)

      if (broadcast.excludeSocketId) {
        emitter = emitter.except(broadcast.excludeSocketId)
      }

      emitter.emit(broadcast.event, broadcast.data)

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
    if (!this._io) {
      throw new ServiceError(
        'Socket.IO server not attached',
        'NO_WEBSOCKET_SERVER',
        this.name
      )
    }

    this.logServiceOperation('broadcastToUser', { userId, event })

    try {
      const userSockets = this._userSocketMap.get(userId)

      if (!userSockets || userSockets.size === 0) {
        this._logger.debug(`User ${userId} not connected - skipping broadcast`)
        return
      }

      // Broadcast to each socket for this user
      for (const socketId of userSockets) {
        this._io.to(socketId).emit(event, data)
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
    if (!this._io) {
      throw new ServiceError(
        'Socket.IO server not attached',
        'NO_WEBSOCKET_SERVER',
        this.name
      )
    }

    this.logServiceOperation('broadcastToAll', { event })

    try {
      this._io.emit(event, data)
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
    return Array.from(this._userSocketMap.keys())
  }

  /**
   * Get socket count for a specific user
   */
  getUserSocketCount(userId: string): number {
    const userSockets = this._userSocketMap.get(userId)
    return userSockets ? userSockets.size : 0
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
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
    })

    // Clear tracking maps
    this._userSocketMap.clear()
    this._socketUserMap.clear()

    // Note: Don't close the Socket.IO server here as it's managed externally
    this._io = null

    await super.cleanup()
  }

  async healthCheck(): Promise<boolean> {
    return this._io !== null
  }
}
