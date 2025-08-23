/**
 * Service Types and Interfaces for tRPC-First Architecture
 * Services receive data from tRPC layer and perform business logic
 */

// Message and Conversation Types
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

// LLM Provider Types
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

// Tool Execution Types
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

// File Operations Types
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

// WebSocket Event Types
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

// Service Configuration Types
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

// Context and User Types (passed from tRPC)
export interface ServiceContext {
  userId: string
  userEmail: string
  userName: string
  sessionId: string
  requestId: string
  timestamp: Date
}

// Error Types
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public serviceName: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export class ValidationError extends ServiceError {
  constructor(
    message: string,
    serviceName: string,
    public field?: string
  ) {
    super(message, 'VALIDATION_ERROR', serviceName)
    this.name = 'ValidationError'
  }
}

export class ExternalServiceError extends ServiceError {
  constructor(
    message: string,
    serviceName: string,
    public provider: string,
    public statusCode?: number
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', serviceName)
    this.name = 'ExternalServiceError'
  }
}
