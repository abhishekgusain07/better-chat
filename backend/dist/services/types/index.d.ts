export interface MessageData {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]
  files?: string[]
  tokenCount?: number
  providerMetadata?: Record<string, any>
  createdAt: Date
}
export interface ConversationData {
  id: string
  userId: string
  title?: string
  provider: string
  model: string
  systemPrompt?: string
  contextWindowSize: number
  autoApprovalSettings: Record<string, any>
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
export interface LLMRequest {
  provider: string
  model: string
  messages: MessageData[]
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  tools?: ToolDefinition[]
}
export interface LLMResponse {
  content: string
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  cost?: number
  toolCalls?: ToolCall[]
  providerMetadata: Record<string, any>
}
export interface LLMStreamChunk {
  content: string
  isComplete: boolean
  tokenUsage?: {
    input: number
    output: number
    total: number
  }
}
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, any>
}
export interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
}
export interface ToolExecutionRequest {
  id: string
  toolName: string
  parameters: Record<string, any>
  conversationId: string
  messageId: string
  userId: string
}
export interface ToolExecutionResult {
  id: string
  success: boolean
  result?: any
  error?: string
  executionTimeMs: number
  cost?: number
}
export interface FileUploadRequest {
  filename: string
  content: Buffer | string
  mimeType: string
  userId: string
  conversationId?: string
}
export interface FileUploadResult {
  id: string
  filename: string
  storagePath: string
  fileSize: number
  contentHash: string
  url?: string
}
export interface WebSocketMessage {
  event: string
  data: any
  conversationId?: string
  userId?: string
}
export interface WebSocketBroadcast {
  room: string
  event: string
  data: any
  excludeSocketId?: string
}
export interface ServiceConfig {
  name: string
  enabled: boolean
  config: Record<string, any>
}
export interface LLMProviderConfig {
  provider: string
  apiKey: string
  baseUrl?: string
  maxRetries?: number
  timeout?: number
  rateLimits?: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
}
export interface ServiceContext {
  userId: string
  userEmail: string
  userName: string
  sessionId: string
  requestId: string
  timestamp: Date
}
export declare class ServiceError extends Error {
  code: string
  serviceName: string
  cause?: Error | undefined
  constructor(
    message: string,
    code: string,
    serviceName: string,
    cause?: Error | undefined
  )
}
export declare class ValidationError extends ServiceError {
  field?: string | undefined
  constructor(message: string, serviceName: string, field?: string | undefined)
}
export declare class ExternalServiceError extends ServiceError {
  provider: string
  statusCode?: number | undefined
  constructor(
    message: string,
    serviceName: string,
    provider: string,
    statusCode?: number | undefined
  )
}
//# sourceMappingURL=index.d.ts.map
