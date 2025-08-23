'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.ChatService = void 0
const service_1 = require('../base/service')
const types_1 = require('../types')
class ChatService extends service_1.BaseService {
  constructor() {
    super('chat-service')
  }
  async initialize() {
    this._logger.info('Initializing Chat Service...')
    this._logger.info('✅ Chat Service initialized')
  }
  async processUserMessage(context, message, conversation) {
    this.logServiceOperation('processUserMessage', {
      messageId: message.id,
      conversationId: conversation.id,
      userId: context.userId,
    })
    if (!this.validateMessage(message.content, message.images, message.files)) {
      throw new types_1.ServiceError(
        'Invalid message content',
        'INVALID_MESSAGE',
        this.name
      )
    }
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
      this.logServiceError('WebSocket broadcast failed', error)
    }
    this._logger.debug(`User message processed: ${message.id}`)
  }
  async generateAssistantResponse(context, messages, conversation) {
    this.logServiceOperation('generateAssistantResponse', {
      conversationId: conversation.id,
      messageCount: messages.length,
      provider: conversation.provider,
      model: conversation.model,
    })
    try {
      const llmService = this._getLLMService()
      const request = {
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
      const response = await llmService.generateResponse(request)
      this.logServiceOperation('Assistant response generated', {
        conversationId: conversation.id,
        tokenUsage: response.tokenUsage,
        cost: response.cost,
      })
      return response
    } catch (error) {
      this.logServiceError('generateAssistantResponse', error)
      throw new types_1.ServiceError(
        'Failed to generate assistant response',
        'LLM_GENERATION_FAILED',
        this.name,
        error
      )
    }
  }
  async streamAssistantResponse(context, messages, conversation, onChunk) {
    this.logServiceOperation('streamAssistantResponse', {
      conversationId: conversation.id,
      messageCount: messages.length,
    })
    try {
      const llmService = this._getLLMService()
      const webSocketService = this._getWebSocketService()
      const request = {
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
      const enhancedOnChunk = (chunk) => {
        onChunk(chunk)
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
          .catch((error) => {
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
      this.logServiceError('streamAssistantResponse', error)
      throw new types_1.ServiceError(
        'Failed to stream assistant response',
        'LLM_STREAMING_FAILED',
        this.name,
        error
      )
    }
  }
  async optimizeConversationContext(messages, maxTokens) {
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
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')
    let optimizedMessages = [...systemMessages]
    let tokens = systemMessages.reduce(
      (acc, msg) => acc + this.calculateTokenCount(msg.content),
      0
    )
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i]
      if (!message) continue
      const messageTokens = this.calculateTokenCount(message.content)
      if (tokens + messageTokens <= maxTokens * 0.8) {
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
  validateMessage(content, images, files) {
    if (!content || content.trim().length === 0) {
      return false
    }
    if (content.length > 50000) {
      return false
    }
    if (images && images.length > 10) {
      return false
    }
    if (files && files.length > 5) {
      return false
    }
    return true
  }
  validateConversation(conversation) {
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
  calculateTokenCount(content) {
    return Math.ceil(content.length / 4)
  }
  estimateCost(tokenUsage, provider) {
    const rates = {
      openai: { input: 0.01 / 1000, output: 0.03 / 1000 },
      anthropic: { input: 0.015 / 1000, output: 0.045 / 1000 },
      default: { input: 0.01 / 1000, output: 0.03 / 1000 },
    }
    const rate = rates[provider] ?? rates.default
    return tokenUsage.input * rate.input + tokenUsage.output * rate.output
  }
  _getLLMService() {
    return null
  }
  _getWebSocketService() {
    return null
  }
  _calculateMaxResponseTokens(contextWindow, messages) {
    const usedTokens = messages.reduce(
      (acc, msg) => acc + this.calculateTokenCount(msg.content),
      0
    )
    const maxResponse = Math.floor((contextWindow - usedTokens) * 0.3)
    return Math.max(maxResponse, 100)
  }
}
exports.ChatService = ChatService
//# sourceMappingURL=chat-service.js.map
