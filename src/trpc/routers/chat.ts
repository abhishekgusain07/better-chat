// Enhanced tRPC Chat Router - integrates with backend service layer
import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'
import { eq, desc, and, sql, isNotNull } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createServiceContext } from '../../../backend/src/services'

// Input validation schemas - inspired by Cline's message validation
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
  id: z.string().uuid(),
  includeMessages: z.boolean().default(true),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
})

const updateConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  systemPrompt: z.string().optional(),
  autoApprovalSettings: z.record(z.string(), z.unknown()).optional(),
})

export const chatRouter = createTRPCRouter({
  // Service integration endpoint for backend health
  getServiceHealth: protectedProcedure.query(async () => {
    try {
      const { getServiceHealth } = await import('../../../backend/src/services')
      return await getServiceHealth()
    } catch (error) {
      return {
        healthy: false,
        services: {},
        timestamp: new Date(),
        error: 'Service layer not available',
      }
    }
  }),
  // Create new conversation - pattern from Cline's task creation
  createConversation: protectedProcedure
    .input(createConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const conversation = await db
        .insert(conversations)
        .values({
          userId: ctx.user.id,
          title: input.title || `New ${input.provider} Chat`,
          provider: input.provider,
          model: input.model,
          systemPrompt: input.systemPrompt,
          contextWindowSize: input.contextWindowSize || 8192,
          autoApprovalSettings: {},
          metadata: {},
        })
        .returning()

      return conversation[0]
    }),

  // Get user conversations - with pagination
  getConversations: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userConversations = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, ctx.user.id))
        .orderBy(desc(conversations.updatedAt))
        .limit(input.limit)
        .offset(input.offset)

      return userConversations
    }),

  // Get single conversation with messages
  getConversation: protectedProcedure
    .input(getConversationSchema)
    .query(async ({ ctx, input }) => {
      // Get conversation
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.id),
            eq(conversations.userId, ctx.user.id)
          )
        )
        .then((rows) => rows[0])

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }

      if (!input.includeMessages) {
        return {
          ...conversation,
          messages: [],
        }
      }

      // Get messages for conversation
      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.id))
        .orderBy(messages.createdAt)
        .limit(input.limit)
        .offset(input.offset)

      return {
        ...conversation,
        messages: conversationMessages,
      }
    }),

  // Send message - enhanced with backend service integration
  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify conversation ownership
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, ctx.user.id)
          )
        )
        .then((rows) => rows[0])

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }

      // Calculate token count using service layer
      let tokenCount: number | null = null
      try {
        // Import service dynamically to avoid circular dependency
        const { Services } = await import('../../../backend/src/services')
        const chatService = Services.chat()
        tokenCount = chatService.calculateTokenCount(input.content)
      } catch (error) {
        console.warn(
          'Service layer not available for token calculation:',
          error
        )
      }

      // Insert user message with token count
      const userMessage = await db
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          role: 'user',
          content: input.content,
          images: input.images || [],
          files: input.files || [],
          tokenCount,
          providerMetadata: {},
        })
        .returning()

      // Update conversation timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, input.conversationId))

      // Process message through service layer
      try {
        const { Services } = await import('../../../backend/src/services')
        const chatService = Services.chat()

        // Create service context from tRPC context
        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId,
        })

        // Process user message (handles WebSocket broadcasting, validation, etc.)
        await chatService.processUserMessage(
          serviceContext,
          {
            id: userMessage[0].id,
            conversationId: input.conversationId,
            role: 'user',
            content: input.content,
            images: input.images || [],
            files: input.files || [],
            tokenCount,
            createdAt: userMessage[0].createdAt,
          },
          {
            id: conversation.id,
            userId: conversation.userId,
            title: conversation.title || 'Chat',
            provider: conversation.provider,
            model: conversation.model,
            systemPrompt: conversation.systemPrompt || undefined,
            contextWindowSize: conversation.contextWindowSize,
            autoApprovalSettings: conversation.autoApprovalSettings,
            metadata: conversation.metadata,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          }
        )
      } catch (error) {
        console.warn('Service layer message processing failed:', error)
        // Continue without service layer processing
      }

      return userMessage[0]
    }),

  // Delete conversation
  deleteConversation: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.id),
            eq(conversations.userId, ctx.user.id)
          )
        )
        .then((rows) => rows[0])

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }

      await db.delete(conversations).where(eq(conversations.id, input.id))

      return { success: true }
    }),

  // Update conversation title/settings
  updateConversation: protectedProcedure
    .input(updateConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input

      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(eq(conversations.id, id), eq(conversations.userId, ctx.user.id))
        )
        .then((rows) => rows[0])

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }

      const updatedConversation = await db
        .update(conversations)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, id))
        .returning()

      return updatedConversation[0]
    }),

  // Get conversation statistics
  getConversationStats: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.id),
            eq(conversations.userId, ctx.user.id)
          )
        )
        .then((rows) => rows[0])

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }

      // Get message count
      const messageCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.conversationId, input.id))
        .then((rows) => rows[0]?.count || 0)

      // Get total token count (sum of all message tokens)
      const totalTokens = await db
        .select({
          total: sql<number>`sum(${messages.tokenCount})`,
        })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, input.id),
            isNotNull(messages.tokenCount)
          )
        )
        .then((rows) => rows[0]?.total || 0)

      return {
        messageCount,
        totalTokens,
        provider: conversation.provider,
        model: conversation.model,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      }
    }),

  // Delete message (for message editing/removal)
  deleteMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        conversationId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify conversation ownership
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, ctx.user.id)
          )
        )
        .then((rows) => rows[0])

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }

      // Delete the message
      await db
        .delete(messages)
        .where(
          and(
            eq(messages.id, input.messageId),
            eq(messages.conversationId, input.conversationId)
          )
        )

      // Update conversation timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, input.conversationId))

      return { success: true }
    }),
})
