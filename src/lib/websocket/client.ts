// WebSocket client for frontend - connects to backend WebSocket server
import { io, Socket } from 'socket.io-client'
import { type ServerToClientEvents, type ClientToServerEvents } from './types'

interface WebSocketConfig {
  url: string
  token: string
  reconnection?: boolean
  reconnectionDelay?: number
  maxReconnectionAttempts?: number
}

class WebSocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null
  private config: WebSocketConfig | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private isConnecting = false
  private listeners: Map<string, Set<Function>> = new Map()

  /**
   * Connect to the WebSocket server
   */
  connect(config: WebSocketConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Connection already in progress'))
        return
      }

      if (this.socket?.connected) {
        resolve()
        return
      }

      this.isConnecting = true
      this.config = config

      const url =
        config.url ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        'http://localhost:8000'

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect()
      }

      // Create new socket connection
      this.socket = io(url, {
        auth: { token: config.token },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        reconnection: config.reconnection ?? true,
        reconnectionDelay: config.reconnectionDelay ?? 1000,
        reconnectionAttempts:
          config.maxReconnectionAttempts ?? this.maxReconnectAttempts,
        path: '/ws/',
      })

      // Connection event handlers
      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket?.id)
        this.isConnecting = false
        this.reconnectAttempts = 0
        resolve()
      })

      this.socket.on('authenticated', (data) => {
        console.log('WebSocket authenticated for user:', data.userId)
        this.emit('authenticated', data)
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        this.isConnecting = false

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(
            `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
          )
        } else {
          reject(
            new Error(
              `Failed to connect after ${this.maxReconnectAttempts} attempts: ${error.message}`
            )
          )
        }
      })

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        this.emit('disconnect', reason)
      })

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.emit('error', error)
      })

      // Message event handlers
      this.socket.on('messageReceived', (data) => {
        this.emit('messageReceived', data)
      })

      this.socket.on('messageStreaming', (data) => {
        this.emit('messageStreaming', data)
      })

      // Tool execution events
      this.socket.on('toolExecutionStarted', (data) => {
        this.emit('toolExecutionStarted', data)
      })

      this.socket.on('toolExecutionCompleted', (data) => {
        this.emit('toolExecutionCompleted', data)
      })

      this.socket.on('toolExecutionFailed', (data) => {
        this.emit('toolExecutionFailed', data)
      })

      // Conversation events
      this.socket.on('conversationUpdated', (data) => {
        this.emit('conversationUpdated', data)
      })

      // Set connection timeout
      setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false
          reject(new Error('Connection timeout'))
        }
      }, 15000)
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.config = null
    this.isConnecting = false
    this.listeners.clear()
  }

  /**
   * Check if WebSocket is connected
   */
  get isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * Get socket ID
   */
  get socketId(): string | undefined {
    return this.socket?.id
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected')
    }
    this.socket.emit('joinConversation', { conversationId })
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected')
    }
    this.socket.emit('leaveConversation', { conversationId })
  }

  /**
   * Send a message
   */
  sendMessage(data: {
    conversationId: string
    content: string
    images?: string[]
    files?: string[]
  }): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected')
    }
    this.socket.emit('sendMessage', data)
  }

  /**
   * Approve tool execution
   */
  approveToolExecution(executionId: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected')
    }
    this.socket.emit('approveToolExecution', { executionId })
  }

  /**
   * Reject tool execution
   */
  rejectToolExecution(executionId: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected')
    }
    this.socket.emit('rejectToolExecution', { executionId })
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(callback)
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event: string): void {
    this.listeners.delete(event)
  }

  /**
   * Emit event to registered listeners
   */
  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(
            `Error in WebSocket event listener for ${event}:`,
            error
          )
        }
      })
    }
  }

  /**
   * Reconnect to WebSocket server
   */
  async reconnect(): Promise<void> {
    if (!this.config) {
      throw new Error('No connection config available')
    }

    this.disconnect()
    await this.connect(this.config)
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean
    socketId?: string
    reconnectAttempts: number
    isConnecting: boolean
  } {
    return {
      connected: this.isConnected,
      socketId: this.socketId,
      reconnectAttempts: this.reconnectAttempts,
      isConnecting: this.isConnecting,
    }
  }
}

// Export singleton instance
export const wsClient = new WebSocketClient()

// Export class for testing
export { WebSocketClient }

// Export types for convenience
export type { WebSocketConfig }
