/**
 * Realtime Bridge - Connects tRPC subscriptions with WebSocket service events
 *
 * This module provides the bridge between the backend WebSocket service layer
 * and tRPC subscriptions, enabling real-time features through a clean interface.
 */

import { EventEmitter } from 'events'

// Bridge event types for type safety
export type RealtimeBridgeEvent =
  | {
      type: 'message'
      data: { conversationId: string; message: Record<string, unknown> }
    }
  | {
      type: 'messageStreaming'
      data: {
        conversationId: string
        messageId: string
        content: string
        isComplete: boolean
      }
    }
  | {
      type: 'messageStreamStarted'
      data: { conversationId: string; messageId: string; timestamp: string }
    }
  | {
      type: 'messageStreamEnded'
      data: {
        conversationId: string
        messageId: string
        duration: number
        timestamp: string
      }
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

/**
 * Realtime Bridge Class
 * Manages connections between WebSocket service events and tRPC subscriptions
 */
export class RealtimeBridge {
  private static instance: RealtimeBridge | null = null
  private _eventEmitter = new EventEmitter()
  private _subscriptions = new Map<
    string,
    Set<(event: RealtimeBridgeEvent) => void>
  >()
  private _webSocketServiceEmitter: EventEmitter | null = null

  private constructor() {
    this._eventEmitter.setMaxListeners(500) // Support many concurrent subscriptions
  }

  /**
   * Get singleton instance of the bridge
   */
  static getInstance(): RealtimeBridge {
    if (!RealtimeBridge.instance) {
      RealtimeBridge.instance = new RealtimeBridge()
    }
    return RealtimeBridge.instance
  }

  /**
   * Connect to WebSocket service event emitter
   */
  connectWebSocketService(webSocketEventEmitter: EventEmitter): void {
    if (this._webSocketServiceEmitter) {
      // Disconnect existing listeners
      this._webSocketServiceEmitter.removeAllListeners()
    }

    this._webSocketServiceEmitter = webSocketEventEmitter

    // Listen for WebSocket service events and bridge them to tRPC subscriptions
    this._webSocketServiceEmitter.on(
      'realtime-event',
      (data: RealtimeBridgeEvent) => {
        this._bridgeEvent(data)
      }
    )

    // Listen for specific streaming events
    this._webSocketServiceEmitter.on(
      'messageStreaming',
      (data: RealtimeBridgeEvent['data']) => {
        this._bridgeEvent({
          type: 'messageStreaming',
          data: data as Extract<
            RealtimeBridgeEvent,
            { type: 'messageStreaming' }
          >['data'],
        })
      }
    )

    this._webSocketServiceEmitter.on(
      'messageStreamStarted',
      (data: RealtimeBridgeEvent['data']) => {
        this._bridgeEvent({
          type: 'messageStreamStarted',
          data: data as Extract<
            RealtimeBridgeEvent,
            { type: 'messageStreamStarted' }
          >['data'],
        })
      }
    )

    this._webSocketServiceEmitter.on(
      'messageStreamEnded',
      (data: RealtimeBridgeEvent['data']) => {
        this._bridgeEvent({
          type: 'messageStreamEnded',
          data: data as Extract<
            RealtimeBridgeEvent,
            { type: 'messageStreamEnded' }
          >['data'],
        })
      }
    )
  }

  /**
   * Subscribe to conversation events
   */
  subscribeToConversation(
    conversationId: string,
    callback: (event: RealtimeBridgeEvent) => void
  ): () => void {
    if (!this._subscriptions.has(conversationId)) {
      this._subscriptions.set(conversationId, new Set())
    }

    this._subscriptions.get(conversationId)!.add(callback)

    // Return cleanup function
    return () => {
      const conversationSubs = this._subscriptions.get(conversationId)
      if (conversationSubs) {
        conversationSubs.delete(callback)
        if (conversationSubs.size === 0) {
          this._subscriptions.delete(conversationId)
        }
      }
    }
  }

  /**
   * Subscribe to message streaming for a conversation
   */
  subscribeToMessageStream(
    conversationId: string,
    callback: (
      event: Extract<
        RealtimeBridgeEvent,
        {
          type:
            | 'messageStreaming'
            | 'messageStreamStarted'
            | 'messageStreamEnded'
        }
      >
    ) => void
  ): () => void {
    const wrappedCallback = (event: RealtimeBridgeEvent) => {
      if (
        event.type === 'messageStreaming' ||
        event.type === 'messageStreamStarted' ||
        event.type === 'messageStreamEnded'
      ) {
        if (event.data.conversationId === conversationId) {
          callback(event as any)
        }
      }
    }

    return this.subscribeToConversation(conversationId, wrappedCallback)
  }

  /**
   * Subscribe to all realtime events (global subscription)
   */
  subscribeToAllEvents(
    callback: (event: RealtimeBridgeEvent) => void
  ): () => void {
    const eventKey = 'global'

    if (!this._subscriptions.has(eventKey)) {
      this._subscriptions.set(eventKey, new Set())
    }

    this._subscriptions
      .get(eventKey)!
      .add(callback as (event: RealtimeBridgeEvent) => void)

    return () => {
      const globalSubs = this._subscriptions.get(eventKey)
      if (globalSubs) {
        globalSubs.delete(callback)
        if (globalSubs.size === 0) {
          this._subscriptions.delete(eventKey)
        }
      }
    }
  }

  /**
   * Emit event to subscribers (for manual event triggering)
   */
  emitEvent(event: RealtimeBridgeEvent): void {
    this._bridgeEvent(event)
  }

  /**
   * Get connection stats
   */
  getStats(): {
    activeSubscriptions: number
    conversationsWithSubscriptions: string[]
    totalCallbacks: number
  } {
    const conversationsWithSubscriptions = Array.from(
      this._subscriptions.keys()
    )
    const totalCallbacks = Array.from(this._subscriptions.values()).reduce(
      (sum, callbackSet) => sum + callbackSet.size,
      0
    )

    return {
      activeSubscriptions: this._subscriptions.size,
      conversationsWithSubscriptions,
      totalCallbacks,
    }
  }

  /**
   * Bridge WebSocket service events to tRPC subscriptions
   */
  private _bridgeEvent(event: RealtimeBridgeEvent): void {
    // Emit to specific conversation subscribers
    if ('conversationId' in event.data && event.data.conversationId) {
      const conversationSubs = this._subscriptions.get(
        event.data.conversationId
      )
      if (conversationSubs) {
        conversationSubs.forEach((callback) => {
          try {
            callback(event)
          } catch (error) {
            console.error('Error in subscription callback:', error)
          }
        })
      }
    }

    // Emit to global subscribers
    const globalSubs = this._subscriptions.get('global')
    if (globalSubs) {
      globalSubs.forEach((callback) => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in global subscription callback:', error)
        }
      })
    }

    // Also emit on internal event emitter for debugging/monitoring
    this._eventEmitter.emit('bridge-event', event)
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    this._subscriptions.clear()
    this._eventEmitter.removeAllListeners()

    if (this._webSocketServiceEmitter) {
      this._webSocketServiceEmitter.removeAllListeners()
      this._webSocketServiceEmitter = null
    }
  }
}

// Export singleton instance for easy import
export const realtimeBridge = RealtimeBridge.getInstance()

// Helper type for subscription cleanup functions
export type SubscriptionCleanup = () => void
