import { Server as SocketIOServer } from 'socket.io'
import { AuthUser, AuthSession } from '@/auth'
export interface ServerToClientEvents {
  messageReceived: (data: { conversationId: string; message: any }) => void
  messageStreaming: (data: {
    conversationId: string
    content: string
    isComplete: boolean
  }) => void
  toolExecutionStarted: (data: {
    executionId: string
    toolName: string
  }) => void
  toolExecutionCompleted: (data: { executionId: string; result: any }) => void
  toolExecutionFailed: (data: { executionId: string; error: string }) => void
  conversationUpdated: (data: { conversationId: string; updates: any }) => void
  error: (data: { message: string; code?: string }) => void
  authenticated: (data: { userId: string; name: string; email: string }) => void
  test_message_response: (data: {
    message: string
    timestamp: string
    userId: string
  }) => void
  test_auth_response: (data: { authenticated: boolean; user?: any }) => void
  test_pong: (data: { timestamp: string }) => void
}
export interface ClientToServerEvents {
  authenticate: (data: { token: string }) => void
  joinConversation: (data: { conversationId: string }) => void
  leaveConversation: (data: { conversationId: string }) => void
  sendMessage: (data: {
    conversationId: string
    content: string
    images?: string[]
    files?: string[]
  }) => void
  approveToolExecution: (data: { executionId: string }) => void
  rejectToolExecution: (data: { executionId: string }) => void
  test_message: (data: { message: string }) => void
  test_auth: () => void
  test_ping: () => void
}
export interface InterServerEvents {}
export interface SocketData {
  userId: string
  user: AuthUser
  session: AuthSession
  conversations: Set<string>
  isAuthenticated: boolean
}
export declare const setupWebSocket: (io: SocketIOServer) => void
export declare const broadcastToConversation: (
  io: SocketIOServer,
  conversationId: string,
  event: keyof ServerToClientEvents,
  data: any
) => void
export declare const streamMessageToConversation: (
  io: SocketIOServer,
  conversationId: string,
  content: string,
  isComplete?: boolean
) => void
export declare const saveAssistantMessage: (
  conversationId: string,
  content: string,
  tokenCount?: number,
  providerMetadata?: Record<string, any>
) => Promise<never>
export declare const broadcastToUser: (
  io: SocketIOServer,
  userId: string,
  event: keyof ServerToClientEvents,
  data: any
) => void
//# sourceMappingURL=index.d.ts.map
