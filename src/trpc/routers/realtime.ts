// Real-time Router - bridges tRPC subscriptions with WebSocket service layer
import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { EventEmitter } from 'events'
import { realtimeBridge } from '@/lib/realtime-bridge'
import type { RealtimeBridgeEvent } from '@/lib/realtime-bridge'

// Input schemas for real-time operations
const subscribeToConversationSchema = z.object({
  conversationId: z.string().uuid(),
})

const broadcastMessageSchema = z.object({
  conversationId: z.string().uuid(),
  event: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
})

const joinConversationSchema = z.object({
  conversationId: z.string().uuid(),
  socketId: z.string().optional(),
})

// Event types for real-time subscriptions
export type RealtimeEvent =
  | {
      type: 'message'
      data: { conversationId: string; message: Record<string, unknown> }
    }
  | {
      type: 'messageStreaming'
      data: { conversationId: string; content: string; isComplete: boolean }
    }
  | {
      type: 'conversationUpdated'
      data: { conversationId: string; updates: Record<string, unknown> }
    }
  | {
      type: 'userJoined'
      data: { conversationId: string; userId: string; userName: string }
    }
  | { type: 'userLeft'; data: { conversationId: string; userId: string } }
  | {
      type: 'typing'
      data: { conversationId: string; userId: string; isTyping: boolean }
    }
  | { type: 'error'; data: { message: string; code: string } }

// WebSocket Service interface for type safety
interface WebSocketServiceInterface {
  getEventEmitter(): EventEmitter
  emitRealtimeEvent(event: string, data: unknown): void
  broadcastToConversation(broadcast: {
    room: string
    event: string
    data: Record<string, unknown>
    excludeSocketId?: string
  }): Promise<void>
  joinRoom(socketId: string, room: string): Promise<void>
  leaveRoom(socketId: string, room: string): Promise<void>
  getConnectedUsers(): string[]
  getRoomMembers(room: string): string[]
  healthCheck(): Promise<boolean>
}

export const realtimeRouter = createTRPCRouter({
  // Subscribe to conversation events
  subscribeToConversation: protectedProcedure
    .input(subscribeToConversationSchema)
    .subscription(async ({ ctx, input }) => {
      // Verify conversation access
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
          message: 'Conversation not found or access denied',
        })
      }

      return observable<RealtimeEvent>((emit) => {
        let cleanupSubscription: (() => void) | null = null
        let webSocketService: WebSocketServiceInterface | null = null
        let isInitialized = false

        // Initialize WebSocket service connection and bridge
        const initializeWebSocket = async () => {
          try {
            const { Services } = await import('../../../backend/src/services')
            webSocketService = Services.webSocket() as WebSocketServiceInterface

            // Connect realtime bridge to WebSocket service
            const webSocketEventEmitter = webSocketService.getEventEmitter()
            realtimeBridge.connectWebSocketService(webSocketEventEmitter)

            // Subscribe to conversation events via bridge
            cleanupSubscription = realtimeBridge.subscribeToConversation(
              input.conversationId,
              (bridgeEvent: RealtimeBridgeEvent) => {
                // Transform bridge event to tRPC realtime event
                const realtimeEvent: RealtimeEvent = {
                  type: bridgeEvent.type,
                  data: bridgeEvent.data,
                } as RealtimeEvent
                emit.next(realtimeEvent)
              }
            )

            // Emit user joined event through WebSocket service
            webSocketService.emitRealtimeEvent('realtime-event', {
              type: 'userJoined',
              data: {
                conversationId: input.conversationId,
                userId: ctx.user.id,
                userName: ctx.user.name,
                timestamp: new Date().toISOString(),
              },
            })

            isInitialized = true
          } catch {
            emit.next({
              type: 'error',
              data: {
                message: 'Failed to initialize WebSocket connection',
                code: 'WEBSOCKET_INIT_FAILED',
              },
            })
          }
        }

        // Start WebSocket initialization
        initializeWebSocket()

        // Cleanup function
        return () => {
          if (cleanupSubscription) {
            cleanupSubscription()
          }

          if (isInitialized && webSocketService) {
            try {
              // Emit user left event through WebSocket service
              webSocketService.emitRealtimeEvent('realtime-event', {
                type: 'userLeft',
                data: {
                  conversationId: input.conversationId,
                  userId: ctx.user.id,
                  timestamp: new Date().toISOString(),
                },
              })
            } catch {
              console.warn('Error during subscription cleanup')
            }
          }
        }
      })
    }),

  // Subscribe to message streaming for a conversation
  subscribeToMessageStream: protectedProcedure
    .input(subscribeToConversationSchema)
    .subscription(async ({ ctx, input }) => {
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
        conversationId: string
        content: string
        isComplete: boolean
        messageId?: string
        timestamp?: string
      }>((emit) => {
        let cleanupSubscription: (() => void) | null = null
        let webSocketService: WebSocketServiceInterface | null = null

        const initializeStreaming = async () => {
          try {
            const { Services } = await import('../../../backend/src/services')
            webSocketService = Services.webSocket() as WebSocketServiceInterface

            // Connect realtime bridge to WebSocket service if not already connected
            const webSocketEventEmitter = webSocketService.getEventEmitter()
            realtimeBridge.connectWebSocketService(webSocketEventEmitter)

            // Subscribe specifically to message streaming events
            cleanupSubscription = realtimeBridge.subscribeToMessageStream(
              input.conversationId,
              (bridgeEvent) => {
                if (bridgeEvent.type === 'messageStreaming') {
                  emit.next({
                    conversationId: bridgeEvent.data.conversationId,
                    content: bridgeEvent.data.content,
                    isComplete: bridgeEvent.data.isComplete,
                    messageId: bridgeEvent.data.messageId,
                    timestamp: new Date().toISOString(),
                  })
                }
              }
            )
          } catch {
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to initialize message streaming',
              })
            )
          }
        }

        initializeStreaming()

        return () => {
          if (cleanupSubscription) {
            cleanupSubscription()
          }
        }
      })
    }),

  // Broadcast message to conversation (server-side trigger)
  broadcastToConversation: protectedProcedure
    .input(broadcastMessageSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify conversation access
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
          message: 'Conversation not found or access denied',
        })
      }

      try {
        // Use backend WebSocket service for broadcasting
        const { Services } = await import('../../../backend/src/services')
        const webSocketService =
          Services.webSocket() as WebSocketServiceInterface

        // Broadcast via traditional WebSocket
        await webSocketService.broadcastToConversation({
          room: input.conversationId,
          event: input.event,
          data: {
            ...input.data,
            userId: ctx.user.id,
            userName: ctx.user.name,
            timestamp: new Date().toISOString(),
          },
        })

        // Also emit through realtime bridge for tRPC subscriptions
        webSocketService.emitRealtimeEvent('realtime-event', {
          type: 'conversationUpdated',
          data: {
            conversationId: input.conversationId,
            event: input.event,
            updates: {
              ...input.data,
              userId: ctx.user.id,
              userName: ctx.user.name,
              timestamp: new Date().toISOString(),
            },
          },
        })

        return {
          success: true,
          conversationId: input.conversationId,
          event: input.event,
          timestamp: new Date(),
        }
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to broadcast message',
        })
      }
    }),

  // Join conversation (connects to WebSocket service)
  joinConversation: protectedProcedure
    .input(joinConversationSchema)
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
        const { Services } = await import('../../../backend/src/services')
        const webSocketService =
          Services.webSocket() as WebSocketServiceInterface

        // If socketId provided, join the WebSocket room
        if (input.socketId) {
          await webSocketService.joinRoom(input.socketId, input.conversationId)
        }

        // Broadcast user joined event via WebSocket
        await webSocketService.broadcastToConversation({
          room: input.conversationId,
          event: 'userJoined',
          data: {
            userId: ctx.user.id,
            userName: ctx.user.name,
            joinedAt: new Date().toISOString(),
          },
          excludeSocketId: input.socketId, // Don't broadcast to the user who just joined
        })

        // Also emit through realtime bridge for tRPC subscriptions
        webSocketService.emitRealtimeEvent('realtime-event', {
          type: 'userJoined',
          data: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
            userName: ctx.user.name,
            joinedAt: new Date().toISOString(),
          },
        })

        return {
          success: true,
          conversationId: input.conversationId,
          userId: ctx.user.id,
          joinedAt: new Date(),
        }
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to join conversation',
        })
      }
    }),

  // Leave conversation
  leaveConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        socketId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { Services } = await import('../../../backend/src/services')
        const webSocketService =
          Services.webSocket() as WebSocketServiceInterface

        // If socketId provided, leave the WebSocket room
        if (input.socketId) {
          await webSocketService.leaveRoom(input.socketId, input.conversationId)
        }

        // Broadcast user left event via WebSocket
        await webSocketService.broadcastToConversation({
          room: input.conversationId,
          event: 'userLeft',
          data: {
            userId: ctx.user.id,
            userName: ctx.user.name,
            leftAt: new Date().toISOString(),
          },
          excludeSocketId: input.socketId,
        })

        // Also emit through realtime bridge for tRPC subscriptions
        webSocketService.emitRealtimeEvent('realtime-event', {
          type: 'userLeft',
          data: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
            userName: ctx.user.name,
            leftAt: new Date().toISOString(),
          },
        })

        return {
          success: true,
          conversationId: input.conversationId,
          userId: ctx.user.id,
          leftAt: new Date(),
        }
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to leave conversation',
        })
      }
    }),

  // Get real-time conversation status
  getConversationStatus: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
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
        const { Services } = await import('../../../backend/src/services')
        const webSocketService =
          Services.webSocket() as WebSocketServiceInterface

        const connectedUsers = webSocketService.getConnectedUsers()
        const roomMembers = webSocketService.getRoomMembers(
          input.conversationId
        )

        return {
          conversationId: input.conversationId,
          connectedUsers: connectedUsers.length,
          roomMembers: roomMembers.length,
          isOwnerConnected: connectedUsers.includes(ctx.user.id),
          lastActivity: conversation.updatedAt,
          status: 'active',
        }
      } catch {
        // Return basic status if WebSocket service unavailable
        return {
          conversationId: input.conversationId,
          connectedUsers: 0,
          roomMembers: 0,
          isOwnerConnected: false,
          lastActivity: conversation.updatedAt,
          status: 'offline',
        }
      }
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
        const { Services } = await import('../../../backend/src/services')
        const webSocketService =
          Services.webSocket() as WebSocketServiceInterface

        // Broadcast typing indicator via WebSocket
        await webSocketService.broadcastToConversation({
          room: input.conversationId,
          event: 'typing',
          data: {
            userId: ctx.user.id,
            userName: ctx.user.name,
            isTyping: input.isTyping,
            timestamp: new Date().toISOString(),
          },
        })

        // Also emit through realtime bridge for tRPC subscriptions
        webSocketService.emitRealtimeEvent('realtime-event', {
          type: 'typing',
          data: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
            userName: ctx.user.name,
            isTyping: input.isTyping,
            timestamp: new Date().toISOString(),
          },
        })

        return {
          success: true,
          conversationId: input.conversationId,
          isTyping: input.isTyping,
        }
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send typing indicator',
        })
      }
    }),

  // Get WebSocket service health
  getWebSocketHealth: protectedProcedure.query(async () => {
    try {
      const { Services } = await import('../../../backend/src/services')
      const webSocketService = Services.webSocket() as WebSocketServiceInterface

      const connectedUsers = webSocketService.getConnectedUsers()
      const isHealthy = await webSocketService.healthCheck()

      return {
        healthy: isHealthy,
        connectedUsers: connectedUsers.length,
        timestamp: new Date(),
        service: 'WebSocket Service via tRPC',
      }
    } catch {
      return {
        healthy: false,
        connectedUsers: 0,
        timestamp: new Date(),
        service: 'WebSocket Service Unavailable',
      }
    }
  }),
})
