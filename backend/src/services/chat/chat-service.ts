import { BaseService } from '../base/service'
import {
  MessageData,
  ConversationData,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ServiceContext,
  ServiceError,
  WebSocketBroadcast,
} from '../types'

/**
 * Chat Service Interface
 * Handles chat-related business logic without direct database access
 */
export interface IChatService {
  // Message processing
  processUserMessage(
    context: ServiceContext,
    message: MessageData,
    conversation: ConversationData
  ): Promise<void>

  generateAssistantResponse(
    context: ServiceContext,
    messages: MessageData[],
    conversation: ConversationData
  ): Promise<LLMResponse>

  streamAssistantResponse(
    context: ServiceContext,
    messages: MessageData[],
    conversation: ConversationData,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse>

  // Context management
  optimizeConversationContext(
    messages: MessageData[],
    maxTokens: number
  ): Promise<{
    optimizedMessages: MessageData[]
    summary?: string
    tokensSaved: number
  }>

  // Validation
  validateMessage(content: string, images?: string[], files?: string[]): boolean
  validateConversation(conversation: Partial<ConversationData>): boolean

  // Utilities
  calculateTokenCount(content: string): number
  estimateCost(
    tokenUsage: { input: number; output: number },
    provider: string
  ): number
}

/**
 * Chat Service Implementation
 * Processes chat operations and integrates with LLM providers
 */
export class ChatService extends BaseService implements IChatService {
  constructor() {
    super('chat-service')
  }

  async initialize(): Promise<void> {
    this._logger.info('Initializing Chat Service...')
    // Service initialization logic here
    this._logger.info('✅ Chat Service initialized')
  }

  /**
   * Process user message - handles validation and WebSocket broadcasting
   */
  async processUserMessage(
    context: ServiceContext,
    message: MessageData,
    conversation: ConversationData
  ): Promise<void> {
    this.logServiceOperation('processUserMessage', {
      messageId: message.id,
      conversationId: conversation.id,
      userId: context.userId,
    })

    // Validate message content
    if (!this.validateMessage(message.content, message.images, message.files)) {
      throw new ServiceError(
        'Invalid message content',
        'INVALID_MESSAGE',
        this.name
      )
    }

    // Broadcast message to WebSocket clients (if WebSocket service is available)
    try {
      const webSocketService = this._getWebSocketService()
      await webSocketService?.broadcastToConversation({
        room: conversation.id,
        event: 'messageReceived',
        data: {
          conversationId: conversation.id,
          message: message,
        },
      })
    } catch (error) {
      this.logServiceError('WebSocket broadcast failed', error as Error)
      // Don't throw - WebSocket is not critical for message processing
    }

    this._logger.debug(`User message processed: ${message.id}`)
  }

  /**
   * Generate assistant response using configured LLM provider
   */
  async generateAssistantResponse(
    context: ServiceContext,
    messages: MessageData[],
    conversation: ConversationData
  ): Promise<LLMResponse> {
    this.logServiceOperation('generateAssistantResponse', {
      conversationId: conversation.id,
      messageCount: messages.length,
      provider: conversation.provider,
      model: conversation.model,
    })

    try {
      const llmService = this._getLLMService()

      const request: LLMRequest = {
        provider: conversation.provider,
        model: conversation.model,
        messages: messages,
        systemPrompt: conversation.systemPrompt,
        maxTokens: this._calculateMaxResponseTokens(
          conversation.contextWindowSize,
          messages
        ),
        temperature: 0.7, // Default temperature
      }

      const response = await llmService.generateResponse(request)

      this.logServiceOperation('Assistant response generated', {
        conversationId: conversation.id,
        tokenUsage: response.tokenUsage,
        cost: response.cost,
      })

      return response
    } catch (error) {
      this.logServiceError('generateAssistantResponse', error as Error)
      throw new ServiceError(
        'Failed to generate assistant response',
        'LLM_GENERATION_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Stream assistant response with real-time chunks
   */
  async streamAssistantResponse(
    context: ServiceContext,
    messages: MessageData[],
    conversation: ConversationData,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse> {
    this.logServiceOperation('streamAssistantResponse', {
      conversationId: conversation.id,
      messageCount: messages.length,
    })

    try {
      const llmService = this._getLLMService()
      const webSocketService = this._getWebSocketService()

      const request: LLMRequest = {
        provider: conversation.provider,
        model: conversation.model,
        messages: messages,
        systemPrompt: conversation.systemPrompt,
        maxTokens: this._calculateMaxResponseTokens(
          conversation.contextWindowSize,
          messages
        ),
        temperature: 0.7,
      }

      // Enhanced chunk handler that broadcasts via WebSocket
      const enhancedOnChunk = (chunk: LLMStreamChunk) => {
        // Call the provided callback
        onChunk(chunk)

        // Broadcast via WebSocket
        webSocketService
          ?.broadcastToConversation({
            room: conversation.id,
            event: 'messageStreaming',
            data: {
              conversationId: conversation.id,
              content: chunk.content,
              isComplete: chunk.isComplete,
            },
          })
          .catch((error: Error) => {
            this.logServiceError('WebSocket streaming broadcast failed', error)
          })
      }

      const response = await llmService.streamResponse(request, enhancedOnChunk)

      this.logServiceOperation('Streaming response completed', {
        conversationId: conversation.id,
        tokenUsage: response.tokenUsage,
      })

      return response
    } catch (error) {
      this.logServiceError('streamAssistantResponse', error as Error)
      throw new ServiceError(
        'Failed to stream assistant response',
        'LLM_STREAMING_FAILED',
        this.name,
        error as Error
      )
    }
  }

  /**
   * Optimize conversation context when approaching token limits
   */
  async optimizeConversationContext(
    messages: MessageData[],
    maxTokens: number
  ): Promise<{
    optimizedMessages: MessageData[]
    summary?: string
    tokensSaved: number
  }> {
    this.logServiceOperation('optimizeConversationContext', {
      originalMessageCount: messages.length,
      maxTokens,
    })

    let currentTokens = 0
    for (const message of messages) {
      currentTokens += this.calculateTokenCount(message.content)
    }

    if (currentTokens <= maxTokens) {
      return {
        optimizedMessages: messages,
        tokensSaved: 0,
      }
    }

    // Simple truncation strategy - keep system message and last N messages
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    let optimizedMessages = [...systemMessages]
    let tokens = systemMessages.reduce(
      (acc, msg) => acc + this.calculateTokenCount(msg.content),
      0
    )

    // Add messages from the end until we hit the token limit
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i]
      if (!message) continue

      const messageTokens = this.calculateTokenCount(message.content)
      if (tokens + messageTokens <= maxTokens * 0.8) {
        // Leave 20% buffer
        optimizedMessages.unshift(message)
        tokens += messageTokens
      } else {
        break
      }
    }

    const tokensSaved = currentTokens - tokens

    this.logServiceOperation('Context optimization completed', {
      originalMessages: messages.length,
      optimizedMessages: optimizedMessages.length,
      tokensSaved,
    })

    return {
      optimizedMessages,
      tokensSaved,
    }
  }

  /**
   * Validate message content
   */
  validateMessage(
    content: string,
    images?: string[],
    files?: string[]
  ): boolean {
    if (!content || content.trim().length === 0) {
      return false
    }

    if (content.length > 50000) {
      // Max message length
      return false
    }

    if (images && images.length > 10) {
      // Max 10 images per message
      return false
    }

    if (files && files.length > 5) {
      // Max 5 files per message
      return false
    }

    return true
  }

  /**
   * Validate conversation configuration
   */
  validateConversation(conversation: Partial<ConversationData>): boolean {
    if (!conversation.provider || !conversation.model) {
      return false
    }

    if (
      conversation.contextWindowSize &&
      (conversation.contextWindowSize < 1000 ||
        conversation.contextWindowSize > 200000)
    ) {
      return false
    }

    return true
  }

  /**
   * Calculate token count for text content
   * Basic implementation - in production would use proper tokenizer
   */
  calculateTokenCount(content: string): number {
    // Rough estimate: ~4 characters per token for English text
    return Math.ceil(content.length / 4)
  }

  /**
   * Estimate cost based on token usage and provider
   */
  estimateCost(
    tokenUsage: { input: number; output: number },
    provider: string
  ): number {
    // Basic cost estimation - would be configured per provider in production
    const rates: Record<string, { input: number; output: number }> = {
      openai: { input: 0.01 / 1000, output: 0.03 / 1000 }, // Per 1k tokens
      anthropic: { input: 0.015 / 1000, output: 0.045 / 1000 },
      default: { input: 0.01 / 1000, output: 0.03 / 1000 },
    }

    const rate = rates[provider] ?? rates.default!
    return tokenUsage.input * rate.input + tokenUsage.output * rate.output
  }

  // Helper methods to get other services (dependency injection)
  private _getLLMService() {
    // In a full implementation, this would use the service registry
    // For now, return null to avoid compilation errors
    return null as any
  }

  private _getWebSocketService() {
    // In a full implementation, this would use the service registry
    return null as any
  }

  private _calculateMaxResponseTokens(
    contextWindow: number,
    messages: MessageData[]
  ): number {
    const usedTokens = messages.reduce(
      (acc, msg) => acc + this.calculateTokenCount(msg.content),
      0
    )
    const maxResponse = Math.floor((contextWindow - usedTokens) * 0.3) // Leave 30% for response
    return Math.max(maxResponse, 100) // Minimum 100 tokens for response
  }
}
