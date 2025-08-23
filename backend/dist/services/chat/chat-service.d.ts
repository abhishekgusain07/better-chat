import { BaseService } from '../base/service'
import {
  MessageData,
  ConversationData,
  LLMResponse,
  LLMStreamChunk,
  ServiceContext,
} from '../types'
export interface IChatService {
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
  optimizeConversationContext(
    messages: MessageData[],
    maxTokens: number
  ): Promise<{
    optimizedMessages: MessageData[]
    summary?: string
    tokensSaved: number
  }>
  validateMessage(content: string, images?: string[], files?: string[]): boolean
  validateConversation(conversation: Partial<ConversationData>): boolean
  calculateTokenCount(content: string): number
  estimateCost(
    tokenUsage: {
      input: number
      output: number
    },
    provider: string
  ): number
}
export declare class ChatService extends BaseService implements IChatService {
  constructor()
  initialize(): Promise<void>
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
  optimizeConversationContext(
    messages: MessageData[],
    maxTokens: number
  ): Promise<{
    optimizedMessages: MessageData[]
    summary?: string
    tokensSaved: number
  }>
  validateMessage(content: string, images?: string[], files?: string[]): boolean
  validateConversation(conversation: Partial<ConversationData>): boolean
  calculateTokenCount(content: string): number
  estimateCost(
    tokenUsage: {
      input: number
      output: number
    },
    provider: string
  ): number
  private _getLLMService
  private _getWebSocketService
  private _calculateMaxResponseTokens
}
//# sourceMappingURL=chat-service.d.ts.map
