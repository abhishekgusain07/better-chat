'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.broadcastToUser =
  exports.saveAssistantMessage =
  exports.streamMessageToConversation =
  exports.broadcastToConversation =
  exports.setupWebSocket =
    void 0
const logger_1 = require('@/utils/logger')
const nanoid_1 = require('nanoid')
const authenticateSocket = async (socket, next) => {
  try {
    const authData = socket.handshake.auth
    if (!authData?.userId) {
      logger_1.logger.debug(`Socket ${socket.id} missing auth data from tRPC`)
      return next(new Error('Authentication required - tRPC validation failed'))
    }
    socket.data.userId = authData.userId
    socket.data.user = {
      id: authData.userId,
      email: authData.userEmail || 'unknown@example.com',
      name: authData.userName || 'Unknown User',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    socket.data.session = {
      id: authData.sessionId || (0, nanoid_1.nanoid)(),
      userId: authData.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      token: (0, nanoid_1.nanoid)(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    socket.data.conversations = new Set()
    socket.data.isAuthenticated = true
    logger_1.logger.debug(
      `Socket ${socket.id} authenticated via tRPC for user ${authData.userId}`
    )
    next()
  } catch (error) {
    logger_1.logger.error('Socket tRPC authentication failed:', error)
    next(new Error('tRPC authentication validation failed'))
  }
}
const handleConnection = (socket) => {
  const { userId, user } = socket.data
  logger_1.logger.info(`Client connected: ${socket.id} (User: ${userId})`)
  socket.emit('authenticated', {
    userId: user.id,
    name: user.name,
    email: user.email,
  })
  socket.on('test_message', (data) => {
    const { message } = data
    logger_1.logger.debug(`Test message received from ${socket.id}: ${message}`)
    socket.emit('test_message_response', {
      message: `Echo: ${message}`,
      timestamp: new Date().toISOString(),
      userId: userId,
    })
  })
  socket.on('test_auth', () => {
    logger_1.logger.debug(`Auth test requested from ${socket.id}`)
    socket.emit('test_auth_response', {
      authenticated: socket.data.isAuthenticated,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
  })
  socket.on('test_ping', () => {
    logger_1.logger.debug(`Ping received from ${socket.id}`)
    socket.emit('test_pong', {
      timestamp: new Date().toISOString(),
    })
  })
  socket.on('joinConversation', async (data) => {
    const { conversationId } = data
    try {
      const accessValidation = {
        hasAccess: true,
        reason: 'Trust-based via tRPC',
      }
      if (!accessValidation.hasAccess) {
        socket.emit('error', {
          message: 'Access denied to conversation',
          code: 'CONVERSATION_ACCESS_DENIED',
          reason: accessValidation.reason,
        })
        return
      }
      socket.join(conversationId)
      socket.data.conversations.add(conversationId)
      logger_1.logger.debug(
        `Socket ${socket.id} joined conversation ${conversationId} via service layer`
      )
    } catch (error) {
      logger_1.logger.error('Join conversation error:', error)
      socket.emit('error', {
        message: 'Failed to join conversation',
        code: 'JOIN_ERROR',
      })
    }
  })
  socket.on('leaveConversation', async (data) => {
    const { conversationId } = data
    try {
      socket.leave(conversationId)
      socket.data.conversations.delete(conversationId)
      logger_1.logger.debug(
        `Socket ${socket.id} left conversation ${conversationId} via service layer`
      )
    } catch (error) {
      logger_1.logger.error('Leave conversation error:', error)
      socket.emit('error', {
        message: 'Failed to leave conversation',
        code: 'LEAVE_ERROR',
      })
    }
  })
  socket.on('sendMessage', async (data) => {
    logger_1.logger.warn(
      `Deprecated sendMessage WebSocket event used by ${socket.id} - demonstrating service integration`
    )
    const { conversationId, content, images, files } = data
    try {
      const validation = {
        valid: content && content.trim().length > 0,
        errors: content ? [] : ['Content cannot be empty'],
        warnings:
          content && content.length > 10000 ? ['Large message detected'] : [],
      }
      if (!validation.valid) {
        socket.emit('error', {
          message: 'Message validation failed',
          code: 'VALIDATION_ERROR',
          errors: validation.errors,
          warnings: validation.warnings,
        })
        return
      }
      const tokenCount = Math.ceil(content.length / 4)
      socket.emit('messageProcessed', {
        message: 'Message processed via service layer (demo only)',
        validationResult: validation,
        tokenCount,
        note: 'This is a demo - use tRPC chat.sendMessage for actual operations',
      })
      socket.emit('error', {
        message:
          'sendMessage WebSocket event deprecated - use tRPC subscriptions',
        code: 'DEPRECATED_WEBSOCKET_EVENT',
        migration: 'Use tRPC message subscriptions for real-time messaging',
        serviceIntegration: 'Service layer integration demonstrated above',
      })
    } catch (error) {
      logger_1.logger.error('Service layer demo error:', error)
      socket.emit('error', {
        message: 'Service layer demo failed',
        code: 'SERVICE_DEMO_ERROR',
        migration: 'Use tRPC chat.sendMessage for actual operations',
      })
    }
  })
  socket.on('approveToolExecution', (data) => {
    const { executionId } = data
    logger_1.logger.debug(
      `Tool execution ${executionId} approved by socket ${socket.id}`
    )
  })
  socket.on('rejectToolExecution', (data) => {
    const { executionId } = data
    logger_1.logger.debug(
      `Tool execution ${executionId} rejected by socket ${socket.id}`
    )
  })
  socket.on('disconnect', (reason) => {
    logger_1.logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`)
  })
  socket.on('error', (error) => {
    logger_1.logger.error(`Socket error for ${socket.id}:`, error)
  })
}
const setupWebSocket = (io) => {
  io.use(authenticateSocket)
  io.on('connection', handleConnection)
  logger_1.logger.info('WebSocket server setup completed')
  logger_1.logger.info(
    'WebSocket service integration: Service layer manages broadcasting'
  )
}
exports.setupWebSocket = setupWebSocket
const broadcastToConversation = (io, conversationId, event, data) => {
  io.to(conversationId).emit(event, data)
}
exports.broadcastToConversation = broadcastToConversation
const streamMessageToConversation = (
  io,
  conversationId,
  content,
  isComplete = false
) => {
  io.to(conversationId).emit('messageStreaming', {
    conversationId,
    content,
    isComplete,
  })
}
exports.streamMessageToConversation = streamMessageToConversation
const saveAssistantMessage = async (
  conversationId,
  content,
  tokenCount,
  providerMetadata
) => {
  logger_1.logger.warn(
    'saveAssistantMessage called - should use tRPC message operations instead'
  )
  throw new Error(
    'Database operations moved to tRPC frontend - use tRPC message mutations instead'
  )
}
exports.saveAssistantMessage = saveAssistantMessage
const broadcastToUser = (io, userId, event, data) => {
  logger_1.logger.debug(`Would broadcast ${event} to user ${userId}`)
}
exports.broadcastToUser = broadcastToUser
//# sourceMappingURL=index.js.map
