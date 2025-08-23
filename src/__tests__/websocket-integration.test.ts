/**
 * Integration tests for WebSocket communication between frontend and backend
 * These tests validate the hybrid architecture communication
 */

import { WebSocketClient } from '@/lib/websocket/client'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/lib/websocket/types'

// Mock socket.io-client for testing
jest.mock('socket.io-client', () => {
  const mockSocket = {
    connected: false,
    id: 'test-socket-id',
    emit: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
  }

  const mockIo = jest.fn(() => mockSocket)
  return {
    io: mockIo,
    Socket: jest.fn(),
  }
})

describe('WebSocket Integration', () => {
  let wsClient: WebSocketClient
  let mockSocket: any

  beforeEach(() => {
    wsClient = new WebSocketClient()
    // Reset mocks
    jest.clearAllMocks()

    // Get reference to mock socket and reset its state
    const { io } = require('socket.io-client')
    mockSocket = io()
    mockSocket.connected = false
    mockSocket.id = 'test-socket-id'
  })

  afterEach(() => {
    wsClient.disconnect()
  })

  describe('Connection Management', () => {
    it('should initialize WebSocket client with correct configuration', () => {
      expect(wsClient).toBeInstanceOf(WebSocketClient)
      expect(wsClient.isConnected).toBe(false)
    })

    it('should connect to WebSocket server with session authentication', async () => {
      const config = {
        url: 'http://localhost:8000',
        reconnection: true,
      }

      // Mock successful connection
      mockSocket.connected = true

      const connectPromise = wsClient.connect(config)

      // Simulate connection success
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1]
      if (connectHandler) {
        connectHandler()
      }

      await expect(connectPromise).resolves.toBeUndefined()

      const { io } = require('socket.io-client')
      expect(io).toHaveBeenCalledWith(
        'http://localhost:8000',
        expect.objectContaining({
          transports: ['websocket', 'polling'],
          timeout: 10000,
          forceNew: true,
          reconnection: true,
          path: '/ws/',
          withCredentials: true, // Session cookies are sent automatically
        })
      )
    })

    it('should handle connection errors gracefully', async () => {
      const config = {
        url: 'http://localhost:8000',
      }

      const connectPromise = wsClient.connect(config)

      // Simulate connection error after a short delay to avoid immediate resolution
      setTimeout(() => {
        const errorHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'connect_error'
        )?.[1]
        if (errorHandler) {
          errorHandler(new Error('Session authentication failed'))
        }
      }, 10)

      await expect(connectPromise).rejects.toThrow()
    }, 10000)

    it('should disconnect properly', async () => {
      // First establish a connection
      const config = { url: 'http://localhost:8000' }
      mockSocket.connected = true

      const connectPromise = wsClient.connect(config)
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1]
      if (connectHandler) connectHandler()
      await connectPromise

      // Now disconnect
      wsClient.disconnect()

      expect(mockSocket.disconnect).toHaveBeenCalled()
      expect(wsClient.isConnected).toBe(false)
    })
  })

  describe('Message Handling', () => {
    beforeEach(async () => {
      mockSocket.connected = true
      const config = { url: 'http://localhost:8000' }

      const connectPromise = wsClient.connect(config)
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1]
      if (connectHandler) connectHandler()
      await connectPromise
    })

    it('should send messages through WebSocket', () => {
      const messageData = {
        conversationId: 'test-conversation-id',
        content: 'Hello, world!',
        images: [],
        files: [],
      }

      wsClient.sendMessage(messageData)

      expect(mockSocket.emit).toHaveBeenCalledWith('sendMessage', messageData)
    })

    it('should handle message received events', () => {
      const messageHandler = jest.fn()
      wsClient.on('messageReceived', messageHandler)

      const messageData = {
        conversationId: 'test-conversation-id',
        message: {
          id: 'msg-1',
          content: 'Hello back!',
          role: 'assistant' as const,
          createdAt: new Date(),
        },
      }

      // Simulate message received from server
      const handler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'messageReceived'
      )?.[1]
      if (handler) {
        handler(messageData)
      }

      expect(messageHandler).toHaveBeenCalledWith(messageData)
    })

    it('should handle message streaming events', () => {
      const streamHandler = jest.fn()
      wsClient.on('messageStreaming', streamHandler)

      const streamData = {
        conversationId: 'test-conversation-id',
        content: 'Hello',
        isComplete: false,
      }

      const handler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'messageStreaming'
      )?.[1]
      if (handler) {
        handler(streamData)
      }

      expect(streamHandler).toHaveBeenCalledWith(streamData)
    })

    it('should handle WebSocket errors', () => {
      const errorHandler = jest.fn()
      wsClient.on('error', errorHandler)

      const errorData = {
        message: 'Something went wrong',
        code: 'WEBSOCKET_ERROR',
      }

      const handler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1]
      if (handler) {
        handler(errorData)
      }

      expect(errorHandler).toHaveBeenCalledWith(errorData)
    })
  })

  describe('Conversation Management', () => {
    beforeEach(async () => {
      mockSocket.connected = true
      const config = { url: 'http://localhost:8000' }

      const connectPromise = wsClient.connect(config)
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1]
      if (connectHandler) connectHandler()
      await connectPromise
    })

    it('should join conversation rooms', () => {
      const conversationId = 'test-conversation-id'

      wsClient.joinConversation(conversationId)

      expect(mockSocket.emit).toHaveBeenCalledWith('joinConversation', {
        conversationId,
      })
    })

    it('should leave conversation rooms', () => {
      const conversationId = 'test-conversation-id'

      wsClient.leaveConversation(conversationId)

      expect(mockSocket.emit).toHaveBeenCalledWith('leaveConversation', {
        conversationId,
      })
    })
  })

  describe('Tool Execution', () => {
    beforeEach(async () => {
      mockSocket.connected = true
      const config = { url: 'http://localhost:8000' }

      const connectPromise = wsClient.connect(config)
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1]
      if (connectHandler) connectHandler()
      await connectPromise
    })

    it('should handle tool execution approval', () => {
      const executionId = 'test-execution-id'

      wsClient.approveToolExecution(executionId)

      expect(mockSocket.emit).toHaveBeenCalledWith('approveToolExecution', {
        executionId,
      })
    })

    it('should handle tool execution rejection', () => {
      const executionId = 'test-execution-id'

      wsClient.rejectToolExecution(executionId)

      expect(mockSocket.emit).toHaveBeenCalledWith('rejectToolExecution', {
        executionId,
      })
    })

    it('should handle tool execution events', () => {
      const startHandler = jest.fn()
      const completeHandler = jest.fn()
      const failHandler = jest.fn()

      wsClient.on('toolExecutionStarted', startHandler)
      wsClient.on('toolExecutionCompleted', completeHandler)
      wsClient.on('toolExecutionFailed', failHandler)

      // Test started event
      const startData = { executionId: 'exec-1', toolName: 'test-tool' }
      const startEventHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'toolExecutionStarted'
      )?.[1]
      if (startEventHandler) startEventHandler(startData)

      // Test completed event
      const completeData = { executionId: 'exec-1', result: { success: true } }
      const completeEventHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'toolExecutionCompleted'
      )?.[1]
      if (completeEventHandler) completeEventHandler(completeData)

      // Test failed event
      const failData = { executionId: 'exec-2', error: 'Tool execution failed' }
      const failEventHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'toolExecutionFailed'
      )?.[1]
      if (failEventHandler) failEventHandler(failData)

      expect(startHandler).toHaveBeenCalledWith(startData)
      expect(completeHandler).toHaveBeenCalledWith(completeData)
      expect(failHandler).toHaveBeenCalledWith(failData)
    })
  })

  describe('Status and Utilities', () => {
    it('should provide connection status', () => {
      const status = wsClient.getStatus()

      expect(status).toEqual({
        connected: false,
        socketId: undefined,
        reconnectAttempts: 0,
        isConnecting: false,
      })
    })

    it('should handle event listeners correctly', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      // Add listeners
      wsClient.on('test-event', handler1)
      wsClient.on('test-event', handler2)

      // Remove specific listener
      wsClient.off('test-event', handler1)

      // Remove all listeners
      wsClient.removeAllListeners('test-event')

      // This test mainly checks that the methods don't throw errors
      expect(() => {
        wsClient.on('another-event', jest.fn())
        wsClient.off('another-event', jest.fn())
        wsClient.removeAllListeners('another-event')
      }).not.toThrow()
    })

    it('should throw error when trying to send messages without connection', () => {
      expect(() => {
        wsClient.sendMessage({
          conversationId: 'test',
          content: 'test message',
        })
      }).toThrow('WebSocket not connected')

      expect(() => {
        wsClient.joinConversation('test')
      }).toThrow('WebSocket not connected')

      expect(() => {
        wsClient.approveToolExecution('test')
      }).toThrow('WebSocket not connected')
    })
  })

  describe('Reconnection Handling', () => {
    it('should support reconnection attempts', async () => {
      const config = {
        url: 'http://localhost:8000',
        reconnection: true,
        maxReconnectionAttempts: 3,
      }

      // First connect to establish config
      mockSocket.connected = true
      const connectPromise = wsClient.connect(config)
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1]
      if (connectHandler) connectHandler()
      await connectPromise

      // Now try to reconnect
      const reconnectPromise = wsClient.reconnect()

      // Should disconnect first
      expect(mockSocket.disconnect).toHaveBeenCalled()

      // Simulate successful reconnection
      const reconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1]
      if (reconnectHandler) reconnectHandler()

      await expect(reconnectPromise).resolves.toBeUndefined()
    })

    it('should throw error when reconnecting without initial connection', async () => {
      await expect(wsClient.reconnect()).rejects.toThrow(
        'No connection config available'
      )
    })
  })
})
