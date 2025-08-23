import { Server as SocketIOServer, Socket } from 'socket.io'
import { logger } from '@/utils/logger'
import { auth, AuthUser, AuthSession } from '@/auth'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

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

// Socket middleware for authentication using better-auth sessions
const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    // Get session from socket headers/cookies
    const sessionResult = await auth.api.getSession({
      headers: socket.handshake.headers as any,
    })

    if (!sessionResult?.user || !sessionResult?.session) {
      logger.debug(`Socket ${socket.id} missing or invalid session`)
      return next(new Error('Authentication required - valid session needed'))
    }

    // Set socket data
    socket.data.userId = sessionResult.user.id
    socket.data.user = sessionResult.user as AuthUser
    socket.data.session = sessionResult.session as AuthSession
    socket.data.conversations = new Set()
    socket.data.isAuthenticated = true

    logger.debug(
      `Socket ${socket.id} authenticated for user ${sessionResult.user.id}`
    )
    next()
  } catch (error) {
    logger.error('Socket session authentication failed:', error)
    next(new Error('Session authentication failed'))
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

  // Conversation management
  socket.on('joinConversation', async (data) => {
    try {
      const { conversationId } = data

      // Verify user has access to conversation
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId)
          )
        )
        .then((rows) => rows[0])

      if (!conversation) {
        socket.emit('error', {
          message: 'Conversation not found or access denied',
          code: 'CONVERSATION_ACCESS_DENIED',
        })
        return
      }

      socket.join(conversationId)
      socket.data.conversations.add(conversationId)

      logger.debug(`Socket ${socket.id} joined conversation ${conversationId}`)
    } catch (error) {
      logger.error('Error joining conversation:', error)
      socket.emit('error', {
        message: 'Failed to join conversation',
        code: 'JOIN_ERROR',
      })
    }
  })

  socket.on('leaveConversation', (data) => {
    const { conversationId } = data

    socket.leave(conversationId)
    socket.data.conversations.delete(conversationId)

    logger.debug(`Socket ${socket.id} left conversation ${conversationId}`)
  })

  // Message handling
  socket.on('sendMessage', async (data) => {
    try {
      const { conversationId, content, images, files } = data

      // Verify user has access to conversation
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId)
          )
        )
        .then((rows) => rows[0])

      if (!conversation) {
        socket.emit('error', {
          message: 'Conversation not found or access denied',
          code: 'CONVERSATION_ACCESS_DENIED',
        })
        return
      }

      // Save user message to database
      const userMessage = await db
        .insert(messages)
        .values({
          conversationId,
          role: 'user',
          content,
          images: images || [],
          files: files || [],
          tokenCount: null, // Will be calculated when LLM integration is added
          providerMetadata: {},
        })
        .returning()

      if (!userMessage[0]) {
        throw new Error('Failed to save message to database')
      }

      // Update conversation timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId))

      const savedMessage = userMessage[0]
      const messageData = {
        id: savedMessage.id,
        conversationId,
        content,
        images: images || [],
        files: files || [],
        role: 'user' as const,
        createdAt: savedMessage.createdAt,
        tokenCount: savedMessage.tokenCount,
      }

      // Broadcast message to all clients in the conversation (including sender)
      socket.to(conversationId).emit('messageReceived', {
        conversationId,
        message: messageData,
      })

      // Send confirmation to sender
      socket.emit('messageReceived', {
        conversationId,
        message: messageData,
      })

      // TODO: Trigger LLM processing for assistant response

      logger.debug(
        `Message saved and broadcast in conversation ${conversationId}`
      )
    } catch (error) {
      logger.error('Error handling sendMessage:', error)
      socket.emit('error', {
        message: 'Failed to send message',
        code: 'MESSAGE_ERROR',
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

  logger.info('WebSocket server setup completed')
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

// Helper function to save assistant message to database
export const saveAssistantMessage = async (
  conversationId: string,
  content: string,
  tokenCount?: number,
  providerMetadata?: Record<string, any>
) => {
  try {
    const assistantMessage = await db
      .insert(messages)
      .values({
        conversationId,
        role: 'assistant',
        content,
        images: [],
        files: [],
        tokenCount,
        providerMetadata: providerMetadata || {},
      })
      .returning()

    // Update conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))

    return assistantMessage[0]
  } catch (error) {
    logger.error('Error saving assistant message:', error)
    throw error
  }
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
