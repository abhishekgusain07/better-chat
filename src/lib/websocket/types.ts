// WebSocket event types for frontend-backend communication
// These should match the backend WebSocket event types

export interface ServerToClientEvents {
  // Authentication events
  authenticated: (data: {
    userId: string
    name?: string
    email?: string
  }) => void

  // Message events
  messageReceived: (data: { conversationId: string; message: any }) => void
  messageStreaming: (data: {
    conversationId: string
    content: string
    isComplete: boolean
  }) => void

  // Tool execution events
  toolExecutionStarted: (data: {
    executionId: string
    toolName: string
  }) => void
  toolExecutionCompleted: (data: { executionId: string; result: any }) => void
  toolExecutionFailed: (data: { executionId: string; error: string }) => void

  // Conversation events
  conversationUpdated: (data: { conversationId: string; updates: any }) => void

  // System events
  error: (data: { message: string; code?: string }) => void
  disconnect: (reason: string) => void
}

export interface ClientToServerEvents {
  // Authentication is handled automatically via session cookies

  // Conversation management
  joinConversation: (data: { conversationId: string }) => void
  leaveConversation: (data: { conversationId: string }) => void

  // Message sending
  sendMessage: (data: {
    conversationId: string
    content: string
    images?: string[]
    files?: string[]
  }) => void

  // Tool execution
  approveToolExecution: (data: { executionId: string }) => void
  rejectToolExecution: (data: { executionId: string }) => void
}

// Message types for frontend use
export interface WebSocketMessage {
  id: string
  conversationId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  images?: string[]
  files?: string[]
  createdAt: Date
  tokenCount?: number | null
}

export interface WebSocketError {
  message: string
  code?: string
}

// Connection status types
export interface ConnectionStatus {
  connected: boolean
  socketId?: string
  reconnectAttempts: number
  isConnecting: boolean
}

// Tool execution types
export interface ToolExecution {
  id: string
  toolName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  startedAt?: Date
  completedAt?: Date
}

// Conversation update types
export interface ConversationUpdate {
  id: string
  title?: string
  updatedAt: Date
  lastMessage?: WebSocketMessage
}
