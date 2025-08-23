'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.batchOperations = exports.chatServiceFunctions = void 0
exports.createServiceContextFromRequest = createServiceContextFromRequest
const types_1 = require('../types')
const service_1 = require('../base/service')
const logger_1 = require('@/utils/logger')
class ChatServiceFunctionsImpl {
  getChatService() {
    try {
      return service_1.serviceRegistry.get('chat-service')
    } catch (error) {
      throw new types_1.ServiceError(
        'Chat service not available',
        'SERVICE_NOT_AVAILABLE',
        'chat-service-functions'
      )
    }
  }
  getWebSocketService() {
    try {
      return service_1.serviceRegistry.get('websocket-service')
    } catch (error) {
      logger_1.logger.warn('WebSocket service not available for broadcasting')
      return null
    }
  }
  async processIncomingMessage(context, messageData, conversationData) {
    const chatService = this.getChatService()
    logger_1.logger.debug('Processing incoming message', {
      messageId: messageData.id,
      conversationId: conversationData.id,
      userId: context.userId,
    })
    try {
      await chatService.processUserMessage(
        context,
        messageData,
        conversationData
      )
      let broadcastSent = false
      const webSocketService = this.getWebSocketService()
      if (webSocketService) {
        try {
          await webSocketService.broadcastToConversation({
            room: conversationData.id,
            event: 'messageReceived',
            data: {
              conversationId: conversationData.id,
              message: messageData,
            },
          })
          broadcastSent = true
        } catch (error) {
          logger_1.logger.warn('WebSocket broadcast failed:', error)
        }
      }
      return {
        success: true,
        messageId: messageData.id,
        broadcastSent,
      }
    } catch (error) {
      logger_1.logger.error('Message processing failed:', error)
      throw new types_1.ServiceError(
        'Failed to process message',
        'MESSAGE_PROCESSING_FAILED',
        'chat-service-functions',
        error
      )
    }
  }
  async validateMessageContent(content, options = {}) {
    const chatService = this.getChatService()
    const errors = []
    const warnings = []
    const isValid = chatService.validateMessage(
      content,
      options.images,
      options.files
    )
    if (!isValid) {
      if (!content || content.trim().length === 0) {
        errors.push('Message content cannot be empty')
      }
      if (content.length > (options.maxLength || 50000)) {
        errors.push(
          `Message exceeds maximum length of ${options.maxLength || 50000} characters`
        )
      }
      if (options.images && options.images.length > 10) {
        errors.push('Too many images attached (maximum 10)')
      }
      if (options.files && options.files.length > 5) {
        errors.push('Too many files attached (maximum 5)')
      }
    }
    if (content.length > 10000) {
      warnings.push('Large message may impact performance')
    }
    const tokenCount = chatService.calculateTokenCount(content)
    if (tokenCount > 2000) {
      warnings.push(
        `High token count (${tokenCount}) may be expensive to process`
      )
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
  async validateConversationAccess(userId, conversationId) {
    logger_1.logger.debug('Validating conversation access (trust-based)', {
      userId,
      conversationId,
    })
    return {
      hasAccess: true,
      reason: 'Trust-based validation via tRPC layer',
    }
  }
  async broadcastMessageToConversation(
    conversationId,
    event,
    data,
    excludeSocketId
  ) {
    const webSocketService = this.getWebSocketService()
    if (!webSocketService) {
      return { success: false, clientCount: 0 }
    }
    try {
      await webSocketService.broadcastToConversation({
        room: conversationId,
        event,
        data,
        excludeSocketId,
      })
      const roomMembers = webSocketService.getRoomMembers(conversationId)
      return {
        success: true,
        clientCount: roomMembers.length,
      }
    } catch (error) {
      logger_1.logger.error('Broadcast failed:', error)
      return { success: false, clientCount: 0 }
    }
  }
  async estimateMessageTokens(content) {
    const chatService = this.getChatService()
    return chatService.calculateTokenCount(content)
  }
  async estimateConversationCost(messages, provider) {
    const chatService = this.getChatService()
    let totalInputTokens = 0
    let totalOutputTokens = 0
    const breakdown = {}
    for (const message of messages) {
      const tokens =
        message.tokenCount || chatService.calculateTokenCount(message.content)
      if (message.role === 'user') {
        totalInputTokens += tokens
      } else if (message.role === 'assistant') {
        totalOutputTokens += tokens
      }
      breakdown[message.role] = (breakdown[message.role] || 0) + tokens
    }
    const totalCost = chatService.estimateCost(
      { input: totalInputTokens, output: totalOutputTokens },
      provider
    )
    return {
      totalCost,
      breakdown: {
        ...breakdown,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCost: totalCost,
      },
    }
  }
  async optimizeMessagesForContext(messages, maxTokens) {
    const chatService = this.getChatService()
    const optimization = await chatService.optimizeConversationContext(
      messages,
      maxTokens
    )
    return {
      optimizedMessages: optimization.optimizedMessages,
      removedCount: messages.length - optimization.optimizedMessages.length,
      tokensSaved: optimization.tokensSaved,
      summary: optimization.summary,
    }
  }
}
exports.chatServiceFunctions = new ChatServiceFunctionsImpl()
function createServiceContextFromRequest(data) {
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
}
exports.batchOperations = {
  async processMessages(contexts, messageDataList, conversationDataList) {
    const results = []
    for (let i = 0; i < messageDataList.length; i++) {
      const context = contexts[i]
      const messageData = messageDataList[i]
      const conversationData = conversationDataList[i]
      if (!context || !messageData || !conversationData) {
        results.push({
          success: false,
          messageId: messageData?.id ?? 'unknown',
          error: 'Missing required data',
        })
        continue
      }
      try {
        const result =
          await exports.chatServiceFunctions.processIncomingMessage(
            context,
            messageData,
            conversationData
          )
        results.push({
          success: result.success,
          messageId: result.messageId,
        })
      } catch (error) {
        results.push({
          success: false,
          messageId: messageDataList[i].id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    return results
  },
  async validateMessages(contents, options) {
    const results = []
    for (let i = 0; i < contents.length; i++) {
      const result = await exports.chatServiceFunctions.validateMessageContent(
        contents[i],
        {
          images: options?.images?.[i] ?? undefined,
          files: options?.files?.[i] ?? undefined,
          maxLength: options?.maxLength,
        }
      )
      results.push(result)
    }
    return results
  },
}
//# sourceMappingURL=service-functions.js.map
