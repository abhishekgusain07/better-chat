// Type definitions for frontend use
import type { RouterOutputs, RouterInputs } from '@/trpc/react'

// Core Chat Types - inferred from tRPC router outputs
export type Conversation = RouterOutputs['chat']['getConversation']
export type ConversationSummary = RouterOutputs['chat']['getConversations'][0]
export type Message = RouterOutputs['chat']['getConversation']['messages'][0]
export type ConversationStats = RouterOutputs['chat']['getConversationStats']

// Input Types - inferred from tRPC router inputs
export type CreateConversationInput = RouterInputs['chat']['createConversation']
export type SendMessageInput = RouterInputs['chat']['sendMessage']
export type UpdateConversationInput = RouterInputs['chat']['updateConversation']
export type GetConversationInput = RouterInputs['chat']['getConversation']
export type GetConversationsInput = RouterInputs['chat']['getConversations']

// Provider Types - will be extended in Phase 2
export interface Provider {
  id: string
  name: string
  models: Model[]
  requiresApiKey: boolean
  supportsStreaming?: boolean
}

export interface Model {
  id: string
  name: string
  maxTokens: number
  contextWindow: number
  supportsImages?: boolean
  supportsTools?: boolean
  costPer1kTokens?: {
    input: number
    output: number
  }
}

// Message Role Types
export type MessageRole = 'user' | 'assistant' | 'system'

// Conversation Status Types
export type ConversationStatus = 'active' | 'archived' | 'deleted'

// Provider List - based on Cline's supported providers
export const SUPPORTED_PROVIDERS: Record<string, Provider> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    requiresApiKey: true,
    supportsStreaming: true,
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        maxTokens: 8192,
        contextWindow: 200000,
        supportsImages: true,
        supportsTools: true,
        costPer1kTokens: { input: 3.0, output: 15.0 },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        maxTokens: 8192,
        contextWindow: 200000,
        supportsImages: true,
        supportsTools: true,
        costPer1kTokens: { input: 0.25, output: 1.25 },
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsImages: true,
        supportsTools: true,
        costPer1kTokens: { input: 15.0, output: 75.0 },
      },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    supportsStreaming: true,
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        maxTokens: 4096,
        contextWindow: 128000,
        supportsImages: true,
        supportsTools: true,
        costPer1kTokens: { input: 2.5, output: 10.0 },
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        maxTokens: 16384,
        contextWindow: 128000,
        supportsImages: true,
        supportsTools: true,
        costPer1kTokens: { input: 0.15, output: 0.6 },
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        maxTokens: 8192,
        contextWindow: 8192,
        supportsImages: false,
        supportsTools: true,
        costPer1kTokens: { input: 30.0, output: 60.0 },
      },
    ],
  },
  google: {
    id: 'google',
    name: 'Google',
    requiresApiKey: true,
    supportsStreaming: true,
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        maxTokens: 8192,
        contextWindow: 2000000,
        supportsImages: true,
        supportsTools: true,
        costPer1kTokens: { input: 1.25, output: 5.0 },
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        maxTokens: 8192,
        contextWindow: 1000000,
        supportsImages: true,
        supportsTools: true,
        costPer1kTokens: { input: 0.075, output: 0.3 },
      },
    ],
  },
} as const

// Utility Types
export type ProviderID = keyof typeof SUPPORTED_PROVIDERS
export type ModelID = string

// Auto Approval Settings
export interface AutoApprovalSettings {
  readOnlyOperations: boolean
  lowRiskOperations: boolean
  specificTools: Record<string, boolean>
  maxCostPerTool: number
  maxCostPerHour: number
  requireApprovalForNewTools: boolean
}

// File Upload Types
export interface FileUpload {
  id: string
  filename: string
  originalName: string
  mimeType: string
  fileSize: number
  storagePath: string
  contentHash?: string
  metadata: Record<string, any>
  createdAt: Date
}

// Error Types
export interface ChatError {
  code: string
  message: string
  details?: Record<string, any>
}

// Utility Functions
export function getProviderById(id: string): Provider | undefined {
  return SUPPORTED_PROVIDERS[id as ProviderID]
}

export function getModelById(
  providerId: string,
  modelId: string
): Model | undefined {
  const provider = getProviderById(providerId)
  return provider?.models.find((model) => model.id === modelId)
}

export function calculateTokenCost(
  providerId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModelById(providerId, modelId)
  if (!model?.costPer1kTokens) return 0

  const inputCost = (inputTokens / 1000) * model.costPer1kTokens.input
  const outputCost = (outputTokens / 1000) * model.costPer1kTokens.output

  return inputCost + outputCost
}

export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1000000).toFixed(1)}M`
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

// Validation Helpers
export function isValidProvider(id: string): id is ProviderID {
  return id in SUPPORTED_PROVIDERS
}

export function isValidModel(providerId: string, modelId: string): boolean {
  const provider = getProviderById(providerId)
  return provider?.models.some((model) => model.id === modelId) ?? false
}

// Message Content Types
export interface MessageContent {
  text: string
  images?: string[]
  files?: FileUpload[]
}

// Conversation Filters
export interface ConversationFilters {
  provider?: string
  model?: string
  dateRange?: {
    start: Date
    end: Date
  }
  hasMessages?: boolean
  isArchived?: boolean
}

// Pagination Types
export interface PaginationParams {
  limit: number
  offset: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  hasMore: boolean
  nextOffset?: number
}

// WebSocket Communication Types (Session-based Authentication)
export interface WebSocketMessage {
  type: 'send_message' | 'typing' | 'stop_typing'
  conversationId: string
  content?: string
  images?: string[]
  files?: string[]
}

export interface WebSocketResponse {
  type:
    | 'message_chunk'
    | 'message_complete'
    | 'error'
    | 'typing'
    | 'user_message'
  conversationId: string
  messageId?: string
  content?: string
  error?: string
  message?: Message
}

// Real-time Event Types
export interface MessageReceivedEvent {
  conversationId: string
  message: Message
}

export interface MessageStreamingEvent {
  conversationId: string
  content: string
  isComplete: boolean
}

export interface ToolExecutionEvent {
  executionId: string
  toolName?: string
  result?: any
  error?: string
}

export interface ConversationUpdatedEvent {
  conversationId: string
  updates: Partial<Conversation>
}

// WebSocket Client Status
export interface WebSocketStatus {
  connected: boolean
  socketId?: string
  reconnectAttempts: number
  isConnecting: boolean
}
