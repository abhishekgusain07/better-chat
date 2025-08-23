'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.WebSocketService = void 0
const service_1 = require('../base/service')
const types_1 = require('../types')
class WebSocketService extends service_1.BaseService {
  _io = null
  _userSocketMap = new Map()
  _socketUserMap = new Map()
  constructor() {
    super('websocket-service')
  }
  async initialize() {
    this._logger.info('Initializing WebSocket Service...')
    this._logger.info('✅ WebSocket Service initialized')
  }
  attachSocketServer(io) {
    if (this._io) {
      this._logger.warn('Socket.IO server already attached - replacing')
    }
    this._io = io
    this._setupEventHandlers()
    this._logger.info('Socket.IO server attached to WebSocket service')
  }
  getSocketServer() {
    return this._io
  }
  async broadcastToConversation(broadcast) {
    if (!this._io) {
      throw new types_1.ServiceError(
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
      this.logServiceError('broadcastToConversation', error)
      throw new types_1.ServiceError(
        'Failed to broadcast to conversation',
        'BROADCAST_FAILED',
        this.name,
        error
      )
    }
  }
  async broadcastToUser(userId, event, data) {
    if (!this._io) {
      throw new types_1.ServiceError(
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
      for (const socketId of userSockets) {
        this._io.to(socketId).emit(event, data)
      }
      this._logger.debug(`Broadcast sent to user ${userId}: ${event}`)
    } catch (error) {
      this.logServiceError('broadcastToUser', error)
      throw new types_1.ServiceError(
        'Failed to broadcast to user',
        'BROADCAST_FAILED',
        this.name,
        error
      )
    }
  }
  async broadcastToAll(event, data) {
    if (!this._io) {
      throw new types_1.ServiceError(
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
      this.logServiceError('broadcastToAll', error)
      throw new types_1.ServiceError(
        'Failed to broadcast to all',
        'BROADCAST_FAILED',
        this.name,
        error
      )
    }
  }
  getConnectedUsers() {
    return Array.from(this._userSocketMap.keys())
  }
  getUserSocketCount(userId) {
    const userSockets = this._userSocketMap.get(userId)
    return userSockets ? userSockets.size : 0
  }
  isUserConnected(userId) {
    const userSockets = this._userSocketMap.get(userId)
    return userSockets !== undefined && userSockets.size > 0
  }
  async joinRoom(socketId, room) {
    if (!this._io) {
      throw new types_1.ServiceError(
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
      this.logServiceError('joinRoom', error)
      throw new types_1.ServiceError(
        'Failed to join room',
        'JOIN_ROOM_FAILED',
        this.name,
        error
      )
    }
  }
  async leaveRoom(socketId, room) {
    if (!this._io) {
      throw new types_1.ServiceError(
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
      this.logServiceError('leaveRoom', error)
      throw new types_1.ServiceError(
        'Failed to leave room',
        'LEAVE_ROOM_FAILED',
        this.name,
        error
      )
    }
  }
  getRoomMembers(room) {
    if (!this._io) {
      return []
    }
    const roomSockets = this._io.sockets.adapter.rooms.get(room)
    return roomSockets ? Array.from(roomSockets) : []
  }
  _setupEventHandlers() {
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
  _addUserSocket(userId, socketId) {
    if (!this._userSocketMap.has(userId)) {
      this._userSocketMap.set(userId, new Set())
    }
    this._userSocketMap.get(userId).add(socketId)
    this._socketUserMap.set(socketId, userId)
  }
  _removeUserSocket(userId, socketId) {
    const userSockets = this._userSocketMap.get(userId)
    if (userSockets) {
      userSockets.delete(socketId)
      if (userSockets.size === 0) {
        this._userSocketMap.delete(userId)
      }
    }
    this._socketUserMap.delete(socketId)
  }
  async cleanup() {
    this.logServiceOperation('cleanup', {
      connectedUsers: this._userSocketMap.size,
      connectedSockets: this._socketUserMap.size,
    })
    this._userSocketMap.clear()
    this._socketUserMap.clear()
    this._io = null
    await super.cleanup()
  }
  async healthCheck() {
    return this._io !== null
  }
}
exports.WebSocketService = WebSocketService
//# sourceMappingURL=websocket-service.js.map
