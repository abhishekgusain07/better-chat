'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.LLMService = exports.MockLLMProvider = void 0
const service_1 = require('../base/service')
const types_1 = require('../types')
class MockLLMProvider {
  name = 'mock'
  config = null
  async initialize(config) {
    this.config = config
  }
  async generateResponse(request) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const mockContent = this._generateMockResponse(request)
    const inputTokens = this._estimateTokens(
      request.messages.map((m) => m.content).join(' ')
    )
    const outputTokens = this._estimateTokens(mockContent)
    return {
      content: mockContent,
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost: 0.001,
      providerMetadata: {
        provider: 'mock',
        model: request.model,
        timestamp: new Date().toISOString(),
      },
    }
  }
  async streamResponse(request, onChunk) {
    const mockContent = this._generateMockResponse(request)
    const words = mockContent.split(' ')
    let accumulated = ''
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '')
      accumulated += word
      onChunk({
        content: word,
        isComplete: i === words.length - 1,
      })
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    const inputTokens = this._estimateTokens(
      request.messages.map((m) => m.content).join(' ')
    )
    const outputTokens = this._estimateTokens(mockContent)
    return {
      content: accumulated,
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost: 0.001,
      providerMetadata: {
        provider: 'mock',
        model: request.model,
        streaming: true,
        timestamp: new Date().toISOString(),
      },
    }
  }
  async healthCheck() {
    return true
  }
  _generateMockResponse(request) {
    const lastMessage = request.messages[request.messages.length - 1]
    if (!lastMessage) {
      return `Mock AI response: No messages found. This is a simulated response from the ${request.provider} provider using the ${request.model} model.`
    }
    const responses = [
      `I understand you're asking about: "${lastMessage.content.slice(0, 50)}...". This is a mock response from the ${request.provider} provider using the ${request.model} model.`,
      `Thank you for your message. As a mock AI assistant, I can see you're using the ${request.model} model. Your message was: "${lastMessage.content.slice(0, 30)}..."`,
      `This is a simulated response. Your conversation has ${request.messages.length} messages so far. The last message: "${lastMessage.content.slice(0, 40)}..."`,
      `Mock AI response: I've received your message about "${lastMessage.content.slice(0, 35)}...". In a real implementation, this would be handled by ${request.provider}.`,
    ]
    const selected = responses[Math.floor(Math.random() * responses.length)]
    return selected ?? responses[0]
  }
  _estimateTokens(content) {
    return Math.ceil(content.length / 4)
  }
}
exports.MockLLMProvider = MockLLMProvider
class LLMService extends service_1.BaseService {
  _providers = new Map()
  constructor() {
    super('llm-service')
  }
  async initialize() {
    this._logger.info('Initializing LLM Service...')
    const mockProvider = new MockLLMProvider()
    await this.addProvider(mockProvider, {
      provider: 'mock',
      apiKey: 'mock-key',
    })
    this._logger.info('✅ LLM Service initialized')
  }
  async addProvider(provider, config) {
    this.logServiceOperation('addProvider', { provider: provider.name })
    try {
      await provider.initialize(config)
      this._providers.set(provider.name, provider)
      this._logger.info(`LLM provider added: ${provider.name}`)
    } catch (error) {
      this.logServiceError('addProvider', error)
      throw new types_1.ServiceError(
        `Failed to initialize LLM provider: ${provider.name}`,
        'PROVIDER_INIT_FAILED',
        this.name,
        error
      )
    }
  }
  getProvider(name) {
    return this._providers.get(name) || null
  }
  listProviders() {
    return Array.from(this._providers.keys())
  }
  async generateResponse(request) {
    this.logServiceOperation('generateResponse', {
      provider: request.provider,
      model: request.model,
      messageCount: request.messages.length,
    })
    if (!this.validateRequest(request)) {
      throw new types_1.ServiceError(
        'Invalid LLM request',
        'INVALID_REQUEST',
        this.name
      )
    }
    const provider = this.getProvider(request.provider)
    if (!provider) {
      throw new types_1.ServiceError(
        `LLM provider not found: ${request.provider}`,
        'PROVIDER_NOT_FOUND',
        this.name
      )
    }
    try {
      const startTime = Date.now()
      const response = await provider.generateResponse(request)
      const duration = Date.now() - startTime
      this.logServiceOperation('Response generated', {
        provider: request.provider,
        model: request.model,
        duration,
        tokenUsage: response.tokenUsage,
        cost: response.cost,
      })
      return response
    } catch (error) {
      this.logServiceError('generateResponse', error)
      throw new types_1.ExternalServiceError(
        'Failed to generate LLM response',
        this.name,
        request.provider
      )
    }
  }
  async streamResponse(request, onChunk) {
    this.logServiceOperation('streamResponse', {
      provider: request.provider,
      model: request.model,
      messageCount: request.messages.length,
    })
    if (!this.validateRequest(request)) {
      throw new types_1.ServiceError(
        'Invalid LLM request',
        'INVALID_REQUEST',
        this.name
      )
    }
    const provider = this.getProvider(request.provider)
    if (!provider) {
      throw new types_1.ServiceError(
        `LLM provider not found: ${request.provider}`,
        'PROVIDER_NOT_FOUND',
        this.name
      )
    }
    try {
      const startTime = Date.now()
      const enhancedOnChunk = (chunk) => {
        this.logServiceOperation('streamChunk', {
          provider: request.provider,
          contentLength: chunk.content.length,
          isComplete: chunk.isComplete,
        })
        onChunk(chunk)
      }
      const response = await provider.streamResponse(request, enhancedOnChunk)
      const duration = Date.now() - startTime
      this.logServiceOperation('Streaming completed', {
        provider: request.provider,
        model: request.model,
        duration,
        tokenUsage: response.tokenUsage,
        cost: response.cost,
      })
      return response
    } catch (error) {
      this.logServiceError('streamResponse', error)
      throw new types_1.ExternalServiceError(
        'Failed to stream LLM response',
        this.name,
        request.provider
      )
    }
  }
  validateRequest(request) {
    if (!request.provider || !request.model) {
      return false
    }
    if (!request.messages || request.messages.length === 0) {
      return false
    }
    if (!this._providers.has(request.provider)) {
      return false
    }
    for (const message of request.messages) {
      if (!message.role || !message.content) {
        return false
      }
      if (!['user', 'assistant', 'system'].includes(message.role)) {
        return false
      }
    }
    return true
  }
  estimateTokens(content) {
    return Math.ceil(content.length / 4)
  }
  async cleanup() {
    this.logServiceOperation('cleanup', {
      providers: this._providers.size,
    })
    this._providers.clear()
    await super.cleanup()
  }
  async healthCheck() {
    if (this._providers.size === 0) {
      return false
    }
    for (const [name, provider] of this._providers) {
      try {
        const healthy = await provider.healthCheck()
        if (!healthy) {
          this._logger.warn(`Provider ${name} failed health check`)
          return false
        }
      } catch (error) {
        this._logger.error(`Provider ${name} health check error:`, error)
        return false
      }
    }
    return true
  }
}
exports.LLMService = LLMService
//# sourceMappingURL=llm-service.js.map
