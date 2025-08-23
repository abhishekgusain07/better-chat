// LLM Router - bridges tRPC with backend LLM service layer
import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { db } from '@/db'
import { conversations, messages } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createServiceContext } from '../../../backend/src/services'
import { observable } from '@trpc/server/observable'

// Input schemas
const generateResponseSchema = z.object({
  conversationId: z.string().uuid(),
  stream: z.boolean().default(false),
})

const testLLMSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  message: z.string().min(1),
})

export const llmRouter = createTRPCRouter({
  // Generate AI response for conversation
  generateResponse: protectedProcedure
    .input(generateResponseSchema)
    .mutation(async ({ ctx, input }) => {
      // Get conversation and verify ownership
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

      // Get recent messages for context
      const recentMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(50) // Last 50 messages for context

      // Reverse to chronological order
      const messageHistory = recentMessages.reverse()

      try {
        // Use backend service layer for LLM generation
        const { Services } = await import('../../../backend/src/services')
        const chatService = Services.chat()

        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId,
        })

        // Transform database messages to service format
        const serviceMessages = messageHistory.map((msg) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          images: msg.images || [],
          files: msg.files || [],
          tokenCount: msg.tokenCount,
          providerMetadata: msg.providerMetadata || {},
          createdAt: msg.createdAt,
        }))

        const serviceConversation = {
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

        // Generate response using service layer
        const llmResponse = await chatService.generateAssistantResponse(
          serviceContext,
          serviceMessages,
          serviceConversation
        )

        // Save assistant response to database
        const assistantMessage = await db
          .insert(messages)
          .values({
            conversationId: input.conversationId,
            role: 'assistant',
            content: llmResponse.content,
            images: [],
            files: [],
            tokenCount: llmResponse.tokenUsage.output,
            providerMetadata: llmResponse.providerMetadata,
          })
          .returning()

        // Update conversation timestamp
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, input.conversationId))

        return {
          message: assistantMessage[0],
          tokenUsage: llmResponse.tokenUsage,
          cost: llmResponse.cost,
        }
      } catch (error) {
        console.error('LLM generation failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate AI response',
          cause: error,
        })
      }
    }),

  // Stream AI response (using tRPC observables)
  streamResponse: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .subscription(async ({ ctx, input }) => {
      // Verify conversation ownership first
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

      return observable<{
        content: string
        isComplete: boolean
        tokenUsage?: any
      }>((emit) => {
        ;(async () => {
          try {
            // Get message history
            const recentMessages = await db
              .select()
              .from(messages)
              .where(eq(messages.conversationId, input.conversationId))
              .orderBy(desc(messages.createdAt))
              .limit(50)

            const messageHistory = recentMessages.reverse()

            // Use backend service layer for streaming
            const { Services } = await import('../../../backend/src/services')
            const chatService = Services.chat()

            const serviceContext = createServiceContext({
              userId: ctx.user.id,
              userEmail: ctx.user.email,
              userName: ctx.user.name,
              sessionId: ctx.sessionId,
            })

            const serviceMessages = messageHistory.map((msg) => ({
              id: msg.id,
              conversationId: msg.conversationId,
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content,
              images: msg.images || [],
              files: msg.files || [],
              tokenCount: msg.tokenCount,
              providerMetadata: msg.providerMetadata || {},
              createdAt: msg.createdAt,
            }))

            const serviceConversation = {
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

            let fullContent = ''

            // Stream response with chunk callback
            const finalResponse = await chatService.streamAssistantResponse(
              serviceContext,
              serviceMessages,
              serviceConversation,
              (chunk) => {
                fullContent += chunk.content
                emit.next({
                  content: chunk.content,
                  isComplete: chunk.isComplete,
                  tokenUsage: chunk.tokenUsage,
                })
              }
            )

            // Save complete message to database
            const assistantMessage = await db
              .insert(messages)
              .values({
                conversationId: input.conversationId,
                role: 'assistant',
                content: fullContent,
                images: [],
                files: [],
                tokenCount: finalResponse.tokenUsage.output,
                providerMetadata: finalResponse.providerMetadata,
              })
              .returning()

            // Update conversation timestamp
            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, input.conversationId))

            // Send final completion
            emit.next({
              content: '',
              isComplete: true,
              tokenUsage: finalResponse.tokenUsage,
            })

            emit.complete()
          } catch (error) {
            console.error('Streaming failed:', error)
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Streaming failed',
                cause: error,
              })
            )
          }
        })()

        return () => {
          // Cleanup if subscription is cancelled
        }
      })
    }),

  // Test LLM providers (development/debugging)
  testProvider: protectedProcedure
    .input(testLLMSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { Services } = await import('../../../backend/src/services')
        const llmService = Services.llm()

        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId,
        })

        const testRequest = {
          provider: input.provider,
          model: input.model,
          messages: [
            {
              id: 'test-msg',
              conversationId: 'test-conv',
              role: 'user' as const,
              content: input.message,
              images: [],
              files: [],
              tokenCount: null,
              providerMetadata: {},
              createdAt: new Date(),
            },
          ],
          systemPrompt: 'You are a helpful AI assistant.',
          maxTokens: 1000,
          temperature: 0.7,
        }

        const response = await llmService.generateResponse(testRequest)

        return {
          success: true,
          response: response.content,
          tokenUsage: response.tokenUsage,
          cost: response.cost,
          provider: input.provider,
          model: input.model,
        }
      } catch (error) {
        console.error('Provider test failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Provider test failed',
          cause: error,
        })
      }
    }),

  // Get available LLM providers
  getProviders: protectedProcedure.query(async () => {
    try {
      const { Services } = await import('../../../backend/src/services')
      const llmService = Services.llm()

      const providers = llmService.listProviders()

      return {
        providers,
        defaultProvider: 'mock', // In production, this would be configurable
        availableModels: {
          mock: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet'],
          openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
          anthropic: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
        },
      }
    } catch (error) {
      return {
        providers: [],
        defaultProvider: 'mock',
        availableModels: {},
        error: 'Service layer not available',
      }
    }
  }),

  // Optimize conversation context (for long conversations)
  optimizeContext: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        maxTokens: z.number().min(1000).max(200000).default(8192),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      try {
        // Get all messages
        const allMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .orderBy(messages.createdAt)

        const { Services } = await import('../../../backend/src/services')
        const chatService = Services.chat()

        const serviceMessages = allMessages.map((msg) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          images: msg.images || [],
          files: msg.files || [],
          tokenCount: msg.tokenCount,
          providerMetadata: msg.providerMetadata || {},
          createdAt: msg.createdAt,
        }))

        const optimization = await chatService.optimizeConversationContext(
          serviceMessages,
          input.maxTokens
        )

        return {
          originalMessageCount: allMessages.length,
          optimizedMessageCount: optimization.optimizedMessages.length,
          tokensSaved: optimization.tokensSaved,
          summary: optimization.summary,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Context optimization failed',
          cause: error,
        })
      }
    }),
})
