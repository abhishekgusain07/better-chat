// Enhanced tRPC Chat Router - integrates with backend service layer and real-time subscriptions
import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { db } from '@/db'
import { conversations, messages, toolExecutions } from '@/db/schema'
import { eq, desc, and, sql, isNotNull } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { createServiceContext } from '../../../backend/src/services'
import { realtimeBridge } from '@/lib/realtime-bridge'

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
  images: z.array(z.string().uuid()).optional(), // File IDs from files router
  files: z.array(z.string().uuid()).optional(), // File IDs from files router
  toolExecutions: z.array(z.string()).optional(), // Tool execution IDs
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

      // Validate file access if files are provided
      const validatedImages: string[] = []
      const validatedFiles: string[] = []

      if (input.images && input.images.length > 0) {
        try {
          const { Services } = await import('../../../backend/src/services')
          const fileService = Services.file()

          // Validate each image file belongs to the user
          for (const fileId of input.images) {
            const fileMetadata = await fileService.getFileMetadata(fileId)
            if (fileMetadata && fileMetadata.userId === ctx.user.id) {
              validatedImages.push(fileId)
            }
          }
        } catch (error) {
          console.warn('File validation failed:', error)
        }
      }

      if (input.files && input.files.length > 0) {
        try {
          const { Services } = await import('../../../backend/src/services')
          const fileService = Services.file()

          // Validate each file belongs to the user
          for (const fileId of input.files) {
            const fileMetadata = await fileService.getFileMetadata(fileId)
            if (fileMetadata && fileMetadata.userId === ctx.user.id) {
              validatedFiles.push(fileId)
            }
          }
        } catch (error) {
          console.warn('File validation failed:', error)
        }
      }

      // Insert user message with validated file references
      const userMessage = await db
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          role: 'user',
          content: input.content,
          images: validatedImages,
          files: validatedFiles,
          tokenCount,
          providerMetadata: {
            originalFileCount:
              (input.images?.length || 0) + (input.files?.length || 0),
            validatedFileCount: validatedImages.length + validatedFiles.length,
          },
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
            images: validatedImages,
            files: validatedFiles,
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

      // Broadcast new message via realtime bridge
      try {
        realtimeBridge.emitEvent({
          type: 'message',
          data: {
            conversationId: input.conversationId,
            message: {
              id: userMessage[0].id,
              conversationId: userMessage[0].conversationId,
              role: userMessage[0].role,
              content: userMessage[0].content,
              images: userMessage[0].images,
              files: userMessage[0].files,
              tokenCount: userMessage[0].tokenCount,
              createdAt: userMessage[0].createdAt,
            },
          },
        })
      } catch (error) {
        console.warn('Failed to broadcast new message:', error)
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

      // Broadcast message deletion via realtime bridge
      try {
        realtimeBridge.emitEvent({
          type: 'conversationUpdated',
          data: {
            conversationId: input.conversationId,
            updates: {
              messageDeleted: input.messageId,
            },
          },
        })
      } catch (error) {
        console.warn('Failed to broadcast message deletion:', error)
      }

      return { success: true }
    }),

  // Real-time subscriptions for chat

  // Subscribe to new messages in a conversation
  subscribeToMessages: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .subscription(async ({ ctx, input }) => {
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

      return observable<{
        type: 'newMessage' | 'messageUpdated' | 'messageDeleted'
        message?: {
          id: string
          conversationId: string
          role: string
          content: string
          images: string[]
          files: string[]
          tokenCount: number | null
          createdAt: Date
        }
        messageId?: string
        timestamp: Date
      }>((emit) => {
        let cleanup: (() => void) | null = null

        const initializeSubscription = async () => {
          try {
            // Subscribe to conversation events via realtime bridge
            cleanup = realtimeBridge.subscribeToConversation(
              input.conversationId,
              (bridgeEvent) => {
                // Handle different types of message events
                if (
                  bridgeEvent.type === 'message' &&
                  'message' in bridgeEvent.data
                ) {
                  emit.next({
                    type: 'newMessage',
                    message: bridgeEvent.data.message as {
                      id: string
                      conversationId: string
                      role: string
                      content: string
                      images: string[]
                      files: string[]
                      tokenCount: number | null
                      createdAt: Date
                    },
                    timestamp: new Date(),
                  })
                }

                if (
                  bridgeEvent.type === 'conversationUpdated' &&
                  'updates' in bridgeEvent.data
                ) {
                  const updates = bridgeEvent.data.updates as Record<
                    string,
                    unknown
                  >
                  if (updates.messageUpdated) {
                    emit.next({
                      type: 'messageUpdated',
                      message: updates.messageUpdated,
                      timestamp: new Date(),
                    })
                  }
                  if (updates.messageDeleted) {
                    emit.next({
                      type: 'messageDeleted',
                      messageId: updates.messageDeleted,
                      timestamp: new Date(),
                    })
                  }
                }
              }
            )
          } catch (error) {
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to subscribe to messages',
              })
            )
          }
        }

        initializeSubscription()

        return () => {
          if (cleanup) {
            cleanup()
          }
        }
      })
    }),

  // Subscribe to AI response streaming for a conversation
  subscribeToAIResponse: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        messageId: z.string().uuid().optional(), // Specific message to stream
      })
    )
    .subscription(async ({ ctx, input }) => {
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

      return observable<{
        type: 'streamStart' | 'streamChunk' | 'streamComplete' | 'streamError'
        content?: string
        messageId?: string
        totalTokens?: number
        isComplete?: boolean
        error?: string
        timestamp: Date
      }>((emit) => {
        let cleanup: (() => void) | null = null

        const initializeStreaming = async () => {
          try {
            // Subscribe to message streaming events via realtime bridge
            cleanup = realtimeBridge.subscribeToMessageStream(
              input.conversationId,
              (bridgeEvent) => {
                if (bridgeEvent.type === 'messageStreaming') {
                  // Only emit if this is the message we're interested in (if specified)
                  if (
                    !input.messageId ||
                    bridgeEvent.data.messageId === input.messageId
                  ) {
                    emit.next({
                      type: bridgeEvent.data.isComplete
                        ? 'streamComplete'
                        : 'streamChunk',
                      content: bridgeEvent.data.content,
                      messageId: bridgeEvent.data.messageId,
                      isComplete: bridgeEvent.data.isComplete,
                      timestamp: new Date(),
                    })
                  }
                }

                if (bridgeEvent.type === 'messageStreamStarted') {
                  if (
                    !input.messageId ||
                    bridgeEvent.data.messageId === input.messageId
                  ) {
                    emit.next({
                      type: 'streamStart',
                      messageId: bridgeEvent.data.messageId,
                      timestamp: new Date(),
                    })
                  }
                }

                if (bridgeEvent.type === 'messageStreamEnded') {
                  if (
                    !input.messageId ||
                    bridgeEvent.data.messageId === input.messageId
                  ) {
                    emit.next({
                      type: 'streamComplete',
                      messageId: bridgeEvent.data.messageId,
                      isComplete: true,
                      timestamp: new Date(),
                    })
                  }
                }
              }
            )
          } catch (error) {
            emit.next({
              type: 'streamError',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            })
          }
        }

        initializeStreaming()

        return () => {
          if (cleanup) {
            cleanup()
          }
        }
      })
    }),

  // Subscribe to typing indicators in a conversation
  subscribeToTyping: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .subscription(async ({ ctx, input }) => {
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

      return observable<{
        userId: string
        userName: string
        isTyping: boolean
        timestamp: Date
      }>((emit) => {
        let cleanup: (() => void) | null = null

        const initializeTyping = async () => {
          try {
            // Subscribe to typing events via realtime bridge
            cleanup = realtimeBridge.subscribeToConversation(
              input.conversationId,
              (bridgeEvent) => {
                if (bridgeEvent.type === 'typing') {
                  // Don't emit our own typing events
                  if (bridgeEvent.data.userId !== ctx.user.id) {
                    emit.next({
                      userId: bridgeEvent.data.userId,
                      userName: bridgeEvent.data.userName,
                      isTyping: bridgeEvent.data.isTyping,
                      timestamp: new Date(),
                    })
                  }
                }
              }
            )
          } catch (error) {
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to subscribe to typing indicators',
              })
            )
          }
        }

        initializeTyping()

        return () => {
          if (cleanup) {
            cleanup()
          }
        }
      })
    }),

  // Send typing indicator
  sendTypingIndicator: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        isTyping: z.boolean(),
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

      try {
        // Emit typing event through realtime bridge
        realtimeBridge.emitEvent({
          type: 'typing',
          data: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
            userName: ctx.user.name,
            isTyping: input.isTyping,
          },
        })

        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send typing indicator',
        })
      }
    }),

  // Tool execution integration with chat

  // Request tool execution from chat context
  requestToolExecution: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        messageId: z.string().uuid(),
        toolName: z.string(),
        parameters: z.record(z.unknown()),
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

      try {
        // Use tool service to request execution
        const { Services } = await import('../../../backend/src/services')
        const toolService = Services.tool()

        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId || 'unknown',
        })

        const executionResult = await toolService.requestToolExecution(
          serviceContext,
          {
            messageId: input.messageId,
            conversationId: input.conversationId,
            toolName: input.toolName,
            parameters: input.parameters,
          }
        )

        // Broadcast tool execution request via realtime bridge
        realtimeBridge.emitEvent({
          type: 'conversationUpdated',
          data: {
            conversationId: input.conversationId,
            updates: {
              toolExecutionRequested: {
                executionId: executionResult.executionId,
                toolName: input.toolName,
                status: executionResult.status,
                requiresApproval: executionResult.approvalRequired,
              },
            },
          },
        })

        return executionResult
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to request tool execution',
        })
      }
    }),

  // Subscribe to tool execution updates for a conversation
  subscribeToToolUpdates: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .subscription(async ({ ctx, input }) => {
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

      return observable<{
        type:
          | 'toolRequested'
          | 'toolApproved'
          | 'toolExecuting'
          | 'toolCompleted'
          | 'toolFailed'
        executionId: string
        toolName: string
        status: string
        result?: Record<string, unknown>
        error?: string
        timestamp: Date
      }>((emit) => {
        let cleanup: (() => void) | null = null

        const initializeToolSubscription = async () => {
          try {
            // Subscribe to conversation updates for tool events
            cleanup = realtimeBridge.subscribeToConversation(
              input.conversationId,
              (bridgeEvent) => {
                if (bridgeEvent.type === 'conversationUpdated') {
                  const updates = bridgeEvent.data.updates as Record<
                    string,
                    unknown
                  >

                  // Handle tool execution events
                  if (updates.toolExecutionRequested) {
                    emit.next({
                      type: 'toolRequested',
                      executionId: updates.toolExecutionRequested.executionId,
                      toolName: updates.toolExecutionRequested.toolName,
                      status: updates.toolExecutionRequested.status,
                      timestamp: new Date(),
                    })
                  }

                  if (updates.toolExecutionCompleted) {
                    emit.next({
                      type: 'toolCompleted',
                      executionId: updates.toolExecutionCompleted.executionId,
                      toolName: updates.toolExecutionCompleted.toolName,
                      status: 'completed',
                      result: updates.toolExecutionCompleted.result,
                      timestamp: new Date(),
                    })
                  }

                  if (updates.toolExecutionFailed) {
                    emit.next({
                      type: 'toolFailed',
                      executionId: updates.toolExecutionFailed.executionId,
                      toolName: updates.toolExecutionFailed.toolName,
                      status: 'failed',
                      error: updates.toolExecutionFailed.error,
                      timestamp: new Date(),
                    })
                  }
                }
              }
            )
          } catch (error) {
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to subscribe to tool updates',
              })
            )
          }
        }

        initializeToolSubscription()

        return () => {
          if (cleanup) {
            cleanup()
          }
        }
      })
    }),

  // Get active tool executions for a conversation
  getActiveToolExecutions: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
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

      // Get active tool executions from database
      const activeExecutions = await db
        .select()
        .from(toolExecutions)
        .where(
          and(
            eq(toolExecutions.conversationId, input.conversationId),
            // Only get pending, approved, or executing statuses
            sql`${toolExecutions.status} IN ('pending', 'approval_required', 'approved', 'executing')`
          )
        )
        .orderBy(desc(toolExecutions.createdAt))

      return activeExecutions.map((execution) => ({
        executionId: execution.id,
        messageId: execution.messageId,
        toolName: execution.toolName,
        parameters: execution.parameters,
        status: execution.status,
        approvalRequestedAt: execution.approvalRequestedAt,
        approvedAt: execution.approvedAt,
        executedAt: execution.executedAt,
        createdAt: execution.createdAt,
      }))
    }),
})
