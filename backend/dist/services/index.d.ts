import { serviceRegistry, ServiceRegistry, IService } from './base/service'
import { ChatService } from './chat/chat-service'
import { WebSocketService } from './websocket/websocket-service'
import { LLMService } from './llm/llm-service'
export * from './types'
export * from './base/service'
export * from './chat/chat-service'
export * from './websocket/websocket-service'
export * from './llm/llm-service'
export declare let chatService: ChatService
export declare let webSocketService: WebSocketService
export declare let llmService: LLMService
export declare function initializeServices(): Promise<void>
export declare function cleanupServices(): Promise<void>
export declare function getServiceHealth(): Promise<{
  healthy: boolean
  services: Record<string, boolean>
  timestamp: Date
}>
export declare function getServiceRegistry(): ServiceRegistry
export declare const Services: {
  chat(): ChatService
  webSocket(): WebSocketService
  llm(): LLMService
  get<T extends IService>(serviceName: string): T
}
export interface ServiceLayerConfig {
  chat?: {
    maxMessageLength?: number
    maxImagesPerMessage?: number
    maxFilesPerMessage?: number
  }
  llm?: {
    providers?: Array<{
      name: string
      apiKey: string
      baseUrl?: string
      timeout?: number
    }>
    defaultProvider?: string
    defaultModel?: string
  }
  websocket?: {
    corsOrigins?: string[]
    pingTimeout?: number
    pingInterval?: number
  }
}
export declare function initializeServicesWithConfig(
  config: ServiceLayerConfig
): Promise<void>
export declare function serviceMiddleware(): (
  req: any,
  res: any,
  next: any
) => void
export declare function createServiceContext(data: {
  userId: string
  userEmail: string
  userName: string
  sessionId: string
  requestId?: string
}): {
  userId: string
  userEmail: string
  userName: string
  sessionId: string
  requestId: string
  timestamp: Date
}
export { serviceRegistry as default }
//# sourceMappingURL=index.d.ts.map
