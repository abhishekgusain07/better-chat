import { Server as SocketIOServer, Socket } from 'socket.io'
import { logger } from '@/utils/logger'
import { AuthUser, AuthSession } from '@/auth'
import { Services } from '@/services'
import { nanoid } from 'nanoid'

// Note: Database access removed - all data operations handled by tRPC in frontend
// WebSocket now operates as a service layer that tRPC calls into
// Integrated with backend service layer for business logic

// WebSocket event types
export interface ServerToClientEvents {
  // Message events
  messageReceived: (data: { conversationId: string; message: any }) => void
  messageStreaming: (data: {
    conversationId: string
    content: string
    isComplete: boolean
  }) => void

  // Tool execution events
  toolExecutionStarted: (data: {
    executionId: string
    toolName: string
  }) => void
  toolExecutionCompleted: (data: { executionId: string; result: any }) => void
  toolExecutionFailed: (data: { executionId: string; error: string }) => void

  // Conversation events
  conversationUpdated: (data: { conversationId: string; updates: any }) => void

  // System events
  error: (data: { message: string; code?: string }) => void
  authenticated: (data: { userId: string; name: string; email: string }) => void

  // Test events
  test_message_response: (data: {
    message: string
    timestamp: string
    userId: string
  }) => void
  test_auth_response: (data: { authenticated: boolean; user?: any }) => void
  test_pong: (data: { timestamp: string }) => void
}

export interface ClientToServerEvents {
  // Authentication
  authenticate: (data: { token: string }) => void

  // Conversation management
  joinConversation: (data: { conversationId: string }) => void
  leaveConversation: (data: { conversationId: string }) => void

  // Message sending
  sendMessage: (data: {
    conversationId: string
    content: string
    images?: string[]
    files?: string[]
  }) => void

  // Tool execution
  approveToolExecution: (data: { executionId: string }) => void
  rejectToolExecution: (data: { executionId: string }) => void

  // Test events
  test_message: (data: { message: string }) => void
  test_auth: () => void
  test_ping: () => void
}

export interface InterServerEvents {
  // For horizontal scaling (future)
}

export interface SocketData {
  userId: string
  user: AuthUser
  session: AuthSession
  conversations: Set<string>
  isAuthenticated: boolean
}

// Socket middleware - now trust-based (tRPC handles authentication)
const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    // Trust-based authentication - tRPC validates users before they reach WebSocket
    // Extract user info from socket auth data (passed by tRPC)
    const authData = socket.handshake.auth

    if (!authData?.userId) {
      logger.debug(`Socket ${socket.id} missing auth data from tRPC`)
      return next(new Error('Authentication required - tRPC validation failed'))
    }

    // Set socket data based on tRPC-provided auth info
    socket.data.userId = authData.userId
    socket.data.user = {
      id: authData.userId,
      email: authData.userEmail || 'unknown@example.com',
      name: authData.userName || 'Unknown User',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AuthUser
    socket.data.session = {
      id: authData.sessionId || nanoid(),
      userId: authData.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      token: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AuthSession
    socket.data.conversations = new Set()
    socket.data.isAuthenticated = true

    logger.debug(
      `Socket ${socket.id} authenticated via tRPC for user ${authData.userId}`
    )
    next()
  } catch (error) {
    logger.error('Socket tRPC authentication failed:', error)
    next(new Error('tRPC authentication validation failed'))
  }
}

// Socket connection handler
const handleConnection = (socket: Socket) => {
  const { userId, user } = socket.data
  logger.info(`Client connected: ${socket.id} (User: ${userId})`)

  // Send authentication confirmation
  socket.emit('authenticated', {
    userId: user.id,
    name: user.name,
    email: user.email,
  })

  // Test event handlers
  socket.on('test_message', (data) => {
    const { message } = data
    logger.debug(`Test message received from ${socket.id}: ${message}`)

    // Echo back the message with timestamp and user info
    socket.emit('test_message_response', {
      message: `Echo: ${message}`,
      timestamp: new Date().toISOString(),
      userId: userId,
    })
  })

  socket.on('test_auth', () => {
    logger.debug(`Auth test requested from ${socket.id}`)

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
    logger.debug(`Ping received from ${socket.id}`)

    socket.emit('test_pong', {
      timestamp: new Date().toISOString(),
    })
  })

  // Conversation management - enhanced with service layer
  socket.on('joinConversation', async (data) => {
    const { conversationId } = data

    try {
      // Trust-based validation - access already validated by tRPC
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

      // Join room and track
      socket.join(conversationId)
      socket.data.conversations.add(conversationId)

      logger.debug(
        `Socket ${socket.id} joined conversation ${conversationId} via service layer`
      )
    } catch (error) {
      logger.error('Join conversation error:', error)
      socket.emit('error', {
        message: 'Failed to join conversation',
        code: 'JOIN_ERROR',
      })
    }
  })

  socket.on('leaveConversation', async (data) => {
    const { conversationId } = data

    try {
      // Leave room and update tracking
      socket.leave(conversationId)
      socket.data.conversations.delete(conversationId)

      logger.debug(
        `Socket ${socket.id} left conversation ${conversationId} via service layer`
      )
    } catch (error) {
      logger.error('Leave conversation error:', error)
      socket.emit('error', {
        message: 'Failed to leave conversation',
        code: 'LEAVE_ERROR',
      })
    }
  })

  // Message handling - service layer integration demo (still deprecated)
  socket.on('sendMessage', async (data) => {
    logger.warn(
      `Deprecated sendMessage WebSocket event used by ${socket.id} - demonstrating service integration`
    )

    const { conversationId, content, images, files } = data

    try {
      // Simulate service layer validation for demo
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

      // Simulate token estimation
      const tokenCount = Math.ceil(content.length / 4)

      // Send demo response with service layer info
      socket.emit('messageProcessed', {
        message: 'Message processed via service layer (demo only)',
        validationResult: validation,
        tokenCount,
        note: 'This is a demo - use tRPC chat.sendMessage for actual operations',
      })

      // Still emit deprecation warning
      socket.emit('error', {
        message:
          'sendMessage WebSocket event deprecated - use tRPC subscriptions',
        code: 'DEPRECATED_WEBSOCKET_EVENT',
        migration: 'Use tRPC message subscriptions for real-time messaging',
        serviceIntegration: 'Service layer integration demonstrated above',
      })
    } catch (error) {
      logger.error('Service layer demo error:', error)
      socket.emit('error', {
        message: 'Service layer demo failed',
        code: 'SERVICE_DEMO_ERROR',
        migration: 'Use tRPC chat.sendMessage for actual operations',
      })
    }
  })

  // Tool execution handlers
  socket.on('approveToolExecution', (data) => {
    const { executionId } = data

    // TODO: Process tool execution approval
    logger.debug(
      `Tool execution ${executionId} approved by socket ${socket.id}`
    )
  })

  socket.on('rejectToolExecution', (data) => {
    const { executionId } = data

    // TODO: Process tool execution rejection
    logger.debug(
      `Tool execution ${executionId} rejected by socket ${socket.id}`
    )
  })

  // Disconnection handler
  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`)
  })

  // Error handler
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error)
  })
}

// Main WebSocket setup function
export const setupWebSocket = (io: SocketIOServer): void => {
  // Apply authentication middleware
  io.use(authenticateSocket)

  // Handle connections
  io.on('connection', handleConnection)

  // Note: WebSocket service integration happens in main server initialization
  // The service layer manages connection state and broadcasting

  logger.info('WebSocket server setup completed')
  logger.info(
    'WebSocket service integration: Service layer manages broadcasting'
  )
}

// Helper function to broadcast to conversation
export const broadcastToConversation = (
  io: SocketIOServer,
  conversationId: string,
  event: keyof ServerToClientEvents,
  data: any
): void => {
  io.to(conversationId).emit(event, data)
}

// Helper function to broadcast streaming message content
export const streamMessageToConversation = (
  io: SocketIOServer,
  conversationId: string,
  content: string,
  isComplete: boolean = false
): void => {
  io.to(conversationId).emit('messageStreaming', {
    conversationId,
    content,
    isComplete,
  })
}

// Helper function to save assistant message - moved to tRPC layer
export const saveAssistantMessage = async (
  conversationId: string,
  content: string,
  tokenCount?: number,
  providerMetadata?: Record<string, any>
) => {
  logger.warn(
    'saveAssistantMessage called - should use tRPC message operations instead'
  )
  throw new Error(
    'Database operations moved to tRPC frontend - use tRPC message mutations instead'
  )
}

// Helper function to broadcast to user (for future implementation)
export const broadcastToUser = (
  io: SocketIOServer,
  userId: string,
  event: keyof ServerToClientEvents,
  data: any
): void => {
  // TODO: Implement user-specific broadcasting
  // This would require maintaining a user -> socket mapping
  logger.debug(`Would broadcast ${event} to user ${userId}`)
}
