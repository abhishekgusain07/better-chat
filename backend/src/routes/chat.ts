import express from 'express'
import { z } from 'zod'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'
import { eq, desc, and, sql, isNotNull } from 'drizzle-orm'
import { authenticateSession, requireAuth, getUserId } from '@/auth/middleware'
import { logger } from '@/utils/logger'

const router = express.Router()

// Apply session authentication to all chat routes
router.use(authenticateSession)
router.use(requireAuth)

// Input validation schemas - based on original tRPC schemas
const createConversationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  provider: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  systemPrompt: z.string().optional(),
  contextWindowSize: z.number().min(1000).max(200000).optional(),
})

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1),
  images: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
})

const getConversationSchema = z.object({
  includeMessages: z
    .string()
    .transform((val) => val === 'true')
    .optional()
    .default('false'),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(200))
    .optional()
    .default('50'),
  offset: z
    .string()
    .transform(Number)
    .pipe(z.number().min(0))
    .optional()
    .default('0'),
})

const updateConversationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  systemPrompt: z.string().optional(),
  autoApprovalSettings: z.record(z.string(), z.unknown()).optional(),
})

// Create new conversation
router.post('/conversations', async (req, res): Promise<any> => {
  try {
    const userId = getUserId(req)
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found',
        code: 'USER_NOT_FOUND',
      })
    }

    const input = createConversationSchema.parse(req.body)

    const conversation = await db
      .insert(conversations)
      .values({
        userId,
        title: input.title || `New ${input.provider} Chat`,
        provider: input.provider,
        model: input.model,
        systemPrompt: input.systemPrompt,
        contextWindowSize: input.contextWindowSize || 8192,
        autoApprovalSettings: {},
        metadata: {},
      })
      .returning()

    if (!conversation[0]) {
      throw new Error('Failed to create conversation')
    }

    logger.info(
      `Conversation created: ${conversation[0].id} for user ${userId}`
    )

    res.status(201).json({
      success: true,
      conversation: conversation[0],
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      })
    }

    logger.error('Create conversation error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create conversation',
      code: 'CREATION_FAILED',
    })
  }
})

// Get user conversations with pagination
router.get('/conversations', async (req, res): Promise<any> => {
  try {
    const userId = getUserId(req)
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found',
        code: 'USER_NOT_FOUND',
      })
    }

    const { limit = 20, offset = 0 } = req.query
    const parsedLimit = Math.min(Number(limit) || 20, 100)
    const parsedOffset = Number(offset) || 0

    const userConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(parsedLimit)
      .offset(parsedOffset)

    res.json({
      success: true,
      conversations: userConversations,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: userConversations.length === parsedLimit,
      },
    })
  } catch (error) {
    logger.error('Get conversations error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch conversations',
      code: 'FETCH_FAILED',
    })
  }
})

// Get single conversation with optional messages
router.get('/conversations/:id', async (req, res): Promise<any> => {
  try {
    const userId = getUserId(req)
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found',
        code: 'USER_NOT_FOUND',
      })
    }

    const conversationId = req.params.id
    const query = getConversationSchema.parse(req.query)

    // Get conversation
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
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      })
    }

    let conversationMessages: any[] = []
    if (query.includeMessages) {
      conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt)
        .limit(query.limit)
        .offset(query.offset)
    }

    res.json({
      success: true,
      conversation: {
        ...conversation,
        messages: conversationMessages,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      })
    }

    logger.error('Get conversation error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch conversation',
      code: 'FETCH_FAILED',
    })
  }
})

// Send message to conversation
router.post('/conversations/:id/messages', async (req, res): Promise<any> => {
  try {
    const userId = getUserId(req)
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found',
        code: 'USER_NOT_FOUND',
      })
    }

    const conversationId = req.params.id
    const input = sendMessageSchema.parse({
      ...req.body,
      conversationId,
    })

    // Verify conversation ownership
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
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      })
    }

    // Insert user message
    const userMessage = await db
      .insert(messages)
      .values({
        conversationId,
        role: 'user',
        content: input.content,
        images: input.images || [],
        files: input.files || [],
        tokenCount: null, // Will be calculated when LLM integration is added
        providerMetadata: {},
      })
      .returning()

    if (!userMessage[0]) {
      throw new Error('Failed to save message')
    }

    // Update conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))

    logger.info(
      `Message sent in conversation ${conversationId} by user ${userId}`
    )

    res.status(201).json({
      success: true,
      message: userMessage[0],
    })

    // TODO: Trigger LLM processing for assistant response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      })
    }

    logger.error('Send message error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to send message',
      code: 'SEND_FAILED',
    })
  }
})

// Update conversation title/settings
router.put('/conversations/:id', async (req, res): Promise<any> => {
  try {
    const userId = getUserId(req)
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found',
        code: 'USER_NOT_FOUND',
      })
    }

    const conversationId = req.params.id
    const updates = updateConversationSchema.parse(req.body)

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
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      })
    }

    const updatedConversation = await db
      .update(conversations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning()

    if (!updatedConversation[0]) {
      throw new Error('Failed to update conversation')
    }

    res.json({
      success: true,
      conversation: updatedConversation[0],
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      })
    }

    logger.error('Update conversation error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update conversation',
      code: 'UPDATE_FAILED',
    })
  }
})

// Delete conversation
router.delete('/conversations/:id', async (req, res): Promise<any> => {
  try {
    const userId = getUserId(req)
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found',
        code: 'USER_NOT_FOUND',
      })
    }

    const conversationId = req.params.id

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
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      })
    }

    await db.delete(conversations).where(eq(conversations.id, conversationId))

    logger.info(`Conversation deleted: ${conversationId} by user ${userId}`)

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    })
  } catch (error) {
    logger.error('Delete conversation error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete conversation',
      code: 'DELETE_FAILED',
    })
  }
})

// Get conversation statistics
router.get('/conversations/:id/stats', async (req, res): Promise<any> => {
  try {
    const userId = getUserId(req)
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found',
        code: 'USER_NOT_FOUND',
      })
    }

    const conversationId = req.params.id

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
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      })
    }

    // Get message count
    const messageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .then((rows) => rows[0]?.count || 0)

    // Get total token count (sum of all message tokens)
    const totalTokens = await db
      .select({
        total: sql<number>`sum(${messages.tokenCount})`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          isNotNull(messages.tokenCount)
        )
      )
      .then((rows) => rows[0]?.total || 0)

    res.json({
      success: true,
      stats: {
        messageCount,
        totalTokens,
        provider: conversation.provider,
        model: conversation.model,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    })
  } catch (error) {
    logger.error('Get conversation stats error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch conversation stats',
      code: 'STATS_FAILED',
    })
  }
})

export { router as chatRoutes }
