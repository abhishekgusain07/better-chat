import { ServiceContext, MessageData, ConversationData } from '../types'
export interface ChatServiceFunctions {
  processIncomingMessage(
    context: ServiceContext,
    messageData: MessageData,
    conversationData: ConversationData
  ): Promise<{
    success: boolean
    messageId: string
    broadcastSent: boolean
  }>
  validateMessageContent(
    content: string,
    options?: {
      images?: string[]
      files?: string[]
      maxLength?: number
    }
  ): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }>
  validateConversationAccess(
    userId: string,
    conversationId: string
  ): Promise<{
    hasAccess: boolean
    reason?: string
  }>
  broadcastMessageToConversation(
    conversationId: string,
    event: string,
    data: any,
    excludeSocketId?: string
  ): Promise<{
    success: boolean
    clientCount: number
  }>
  estimateMessageTokens(content: string): Promise<number>
  estimateConversationCost(
    messages: MessageData[],
    provider: string
  ): Promise<{
    totalCost: number
    breakdown: Record<string, number>
  }>
  optimizeMessagesForContext(
    messages: MessageData[],
    maxTokens: number
  ): Promise<{
    optimizedMessages: MessageData[]
    removedCount: number
    tokensSaved: number
    summary?: string
  }>
}
export declare const chatServiceFunctions: ChatServiceFunctions
export declare function createServiceContextFromRequest(data: {
  userId: string
  userEmail?: string
  userName?: string
  sessionId?: string
  requestId?: string
}): ServiceContext
export declare const batchOperations: {
  processMessages(
    contexts: ServiceContext[],
    messageDataList: MessageData[],
    conversationDataList: ConversationData[]
  ): Promise<
    Array<{
      success: boolean
      messageId: string
      error?: string
    }>
  >
  validateMessages(
    contents: string[],
    options?: {
      images?: string[][]
      files?: string[][]
      maxLength?: number
    }
  ): Promise<
    Array<{
      valid: boolean
      errors: string[]
      warnings: string[]
    }>
  >
}
//# sourceMappingURL=service-functions.d.ts.map
