import { ServiceContext, MessageData, ConversationData } from '../types'
export declare const simplifiedChatFunctions: {
  validateMessage(
    content: string,
    options?: {
      images?: string[]
      files?: string[]
      maxLength?: number
    }
  ): {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  estimateTokens(content: string): number
  estimateCost(
    tokenUsage: {
      input: number
      output: number
    },
    provider: string
  ): number
  createServiceContext(data: {
    userId: string
    userEmail?: string
    userName?: string
    sessionId?: string
    requestId?: string
  }): ServiceContext
  processMessage(
    context: ServiceContext,
    messageData: MessageData,
    conversationData: ConversationData
  ): {
    success: boolean
    messageId: string
    timestamp: Date
  }
  optimizeContext(
    messages: MessageData[],
    maxTokens: number
  ): {
    optimizedMessages: MessageData[]
    removedCount: number
    tokensSaved: number
  }
}
export declare const serviceLayerHealthCheck: {
  checkHealth(): Promise<{
    healthy: boolean
    services: string[]
  }>
  getServiceInfo(): Promise<{
    architecture: string
    layer: string
    integration: string
    functions: string[]
  }>
}
//# sourceMappingURL=simplified-functions.d.ts.map
