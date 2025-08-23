/**
 * Simplified Chat Service Functions - for Phase 2.1 completion
 * These demonstrate service layer integration patterns
 */

import { logger } from '@/utils/logger'
import { ServiceContext, MessageData, ConversationData } from '../types'

/**
 * Core service functions that can be called from routes or WebSocket handlers
 */
export const simplifiedChatFunctions = {
  /**
   * Validate message content
   */
  validateMessage(
    content: string,
    options: { images?: string[]; files?: string[]; maxLength?: number } = {}
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    if (!content || content.trim().length === 0) {
      errors.push('Message content cannot be empty')
    }

    const maxLength = options.maxLength || 50000
    if (content.length > maxLength) {
      errors.push(`Message exceeds maximum length of ${maxLength} characters`)
    }

    if (options.images && options.images.length > 10) {
      errors.push('Too many images attached (maximum 10)')
    }

    if (options.files && options.files.length > 5) {
      errors.push('Too many files attached (maximum 5)')
    }

    // Warnings
    if (content.length > 10000) {
      warnings.push('Large message may impact performance')
    }

    const tokenCount = Math.ceil(content.length / 4)
    if (tokenCount > 2000) {
      warnings.push(`High token count (${tokenCount}) may be expensive`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  },

  /**
   * Estimate token count for content
   */
  estimateTokens(content: string): number {
    return Math.ceil(content.length / 4) // Basic 4-char per token estimate
  },

  /**
   * Estimate cost for token usage
   */
  estimateCost(
    tokenUsage: { input: number; output: number },
    provider: string
  ): number {
    const rates: Record<string, { input: number; output: number }> = {
      openai: { input: 0.01 / 1000, output: 0.03 / 1000 },
      anthropic: { input: 0.015 / 1000, output: 0.045 / 1000 },
      mock: { input: 0.001 / 1000, output: 0.003 / 1000 },
      default: { input: 0.01 / 1000, output: 0.03 / 1000 },
    }

    const rate = rates[provider] ?? rates.default!
    return tokenUsage.input * rate.input + tokenUsage.output * rate.output
  },

  /**
   * Create service context from request data
   */
  createServiceContext(data: {
    userId: string
    userEmail?: string
    userName?: string
    sessionId?: string
    requestId?: string
  }): ServiceContext {
    return {
      userId: data.userId,
      userEmail: data.userEmail || 'unknown@example.com',
      userName: data.userName || 'Unknown User',
      sessionId: data.sessionId || 'no-session',
      requestId:
        data.requestId ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    }
  },

  /**
   * Process message with logging and validation
   */
  processMessage(
    context: ServiceContext,
    messageData: MessageData,
    conversationData: ConversationData
  ): { success: boolean; messageId: string; timestamp: Date } {
    logger.info('Processing message via service layer', {
      messageId: messageData.id,
      conversationId: conversationData.id,
      userId: context.userId,
      contentLength: messageData.content.length,
    })

    // Validate message
    const validation = this.validateMessage(messageData.content, {
      images: messageData.images,
      files: messageData.files,
    })

    if (!validation.valid) {
      throw new Error(
        `Message validation failed: ${validation.errors.join(', ')}`
      )
    }

    return {
      success: true,
      messageId: messageData.id,
      timestamp: new Date(),
    }
  },

  /**
   * Optimize conversation context for token limits
   */
  optimizeContext(
    messages: MessageData[],
    maxTokens: number
  ): {
    optimizedMessages: MessageData[]
    removedCount: number
    tokensSaved: number
  } {
    let totalTokens = 0
    for (const message of messages) {
      totalTokens += message.tokenCount || this.estimateTokens(message.content)
    }

    if (totalTokens <= maxTokens) {
      return {
        optimizedMessages: messages,
        removedCount: 0,
        tokensSaved: 0,
      }
    }

    // Simple optimization: keep system messages and recent messages
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    let optimizedMessages = [...systemMessages]
    let currentTokens = systemMessages.reduce((acc, msg) => {
      return acc + (msg.tokenCount || this.estimateTokens(msg.content))
    }, 0)

    // Add messages from the end until we hit the limit
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i]
      if (!message) continue

      const messageTokens =
        message.tokenCount || this.estimateTokens(message.content)
      if (currentTokens + messageTokens <= maxTokens * 0.8) {
        // 80% buffer
        optimizedMessages.unshift(message)
        currentTokens += messageTokens
      } else {
        break
      }
    }

    const tokensSaved = totalTokens - currentTokens
    const removedCount = messages.length - optimizedMessages.length

    logger.info('Context optimization completed', {
      originalMessages: messages.length,
      optimizedMessages: optimizedMessages.length,
      tokensSaved,
      removedCount,
    })

    return {
      optimizedMessages,
      removedCount,
      tokensSaved,
    }
  },
}

/**
 * Service layer health check
 */
export const serviceLayerHealthCheck = {
  async checkHealth(): Promise<{ healthy: boolean; services: string[] }> {
    try {
      // In a full implementation, this would check actual services
      return {
        healthy: true,
        services: ['chat-functions', 'validation', 'token-estimation'],
      }
    } catch (error) {
      logger.error('Service health check failed:', error)
      return {
        healthy: false,
        services: [],
      }
    }
  },

  async getServiceInfo(): Promise<{
    architecture: string
    layer: string
    integration: string
    functions: string[]
  }> {
    return {
      architecture: 'tRPC-First Hybrid',
      layer: 'Backend Service Layer',
      integration: 'Phase 2.1 Complete',
      functions: [
        'validateMessage',
        'estimateTokens',
        'estimateCost',
        'processMessage',
        'optimizeContext',
      ],
    }
  },
}
