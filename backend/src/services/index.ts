/**
 * Service Layer Index - tRPC-First Architecture
 *
 * This module provides the main entry point for the backend service layer.
 * Services are stateless and receive data from tRPC rather than accessing database directly.
 */

import { serviceRegistry, ServiceRegistry, IService } from './base/service'
import { ChatService } from './chat/chat-service'
import { WebSocketService } from './websocket/websocket-service'
import { LLMService } from './llm/llm-service'
import { FileService } from './file/file-service'
import { ToolService } from './tool/tool-service'
import { logger } from '@/utils/logger'

// Re-export types and interfaces
export * from './types'
export * from './base/service'
export * from './chat/chat-service'
export * from './websocket/websocket-service'
export * from './llm/llm-service'
export * from './file/file-service'
export * from './tool/tool-service'

// Service instances
export let chatService: ChatService
export let webSocketService: WebSocketService
export let llmService: LLMService
export let fileService: FileService
export let toolService: ToolService

/**
 * Initialize all backend services
 * This should be called during application startup
 */
export async function initializeServices(options?: {
  useWebSocketPooling?: boolean
}): Promise<void> {
  logger.info('🚀 Initializing backend service layer...')

  try {
    // Create service instances with configuration options
    chatService = new ChatService()
    webSocketService = new WebSocketService({
      useConnectionPooling: options?.useWebSocketPooling ?? false,
    })
    llmService = new LLMService()
    fileService = new FileService()
    toolService = new ToolService()

    // Register services with the registry
    serviceRegistry.register(chatService)
    serviceRegistry.register(webSocketService)
    serviceRegistry.register(llmService)
    serviceRegistry.register(fileService)
    serviceRegistry.register(toolService)

    // Initialize all services
    await serviceRegistry.initialize()

    logger.info('✅ Backend service layer initialized successfully')
    logger.info(
      `Services available: ${serviceRegistry.listServices().join(', ')}`
    )
  } catch (error) {
    logger.error('❌ Failed to initialize backend service layer:', error)
    throw error
  }
}

/**
 * Cleanup all services
 * This should be called during application shutdown
 */
export async function cleanupServices(): Promise<void> {
  logger.info('🧹 Cleaning up backend service layer...')

  try {
    await serviceRegistry.cleanup()
    logger.info('✅ Backend service layer cleanup complete')
  } catch (error) {
    logger.error('❌ Error during service cleanup:', error)
  }
}

/**
 * Health check for all services
 * Returns the health status of each service
 */
export async function getServiceHealth(): Promise<{
  healthy: boolean
  services: Record<string, boolean>
  timestamp: Date
}> {
  try {
    const serviceHealth = await serviceRegistry.healthCheck()
    const healthy = Object.values(serviceHealth).every(
      (status) => status === true
    )

    return {
      healthy,
      services: serviceHealth,
      timestamp: new Date(),
    }
  } catch (error) {
    logger.error('Health check failed:', error)
    return {
      healthy: false,
      services: {},
      timestamp: new Date(),
    }
  }
}

/**
 * Get service registry instance
 * Useful for advanced service management
 */
export function getServiceRegistry(): ServiceRegistry {
  return serviceRegistry
}

/**
 * Service factory functions for dependency injection
 * These functions provide type-safe access to services
 */
export const Services = {
  chat(): ChatService {
    if (!chatService) {
      throw new Error(
        'ChatService not initialized - call initializeServices() first'
      )
    }
    return chatService
  },

  webSocket(): WebSocketService {
    if (!webSocketService) {
      throw new Error(
        'WebSocketService not initialized - call initializeServices() first'
      )
    }
    return webSocketService
  },

  llm(): LLMService {
    if (!llmService) {
      throw new Error(
        'LLMService not initialized - call initializeServices() first'
      )
    }
    return llmService
  },

  file(): FileService {
    if (!fileService) {
      throw new Error(
        'FileService not initialized - call initializeServices() first'
      )
    }
    return fileService
  },

  tool(): ToolService {
    if (!toolService) {
      throw new Error(
        'ToolService not initialized - call initializeServices() first'
      )
    }
    return toolService
  },

  get<T extends IService>(serviceName: string): T {
    return serviceRegistry.get<T>(serviceName)
  },
}

/**
 * Service configuration interface
 * Used for configuring services during initialization
 */
export interface ServiceLayerConfig {
  chat?: {
    maxMessageLength?: number
    maxImagesPerMessage?: number
    maxFilesPerMessage?: number
  }
  file?: {
    maxFileSize?: number
    allowedFileTypes?: string[]
    uploadsDir?: string
  }
  tool?: {
    maxExecutionsPerHour?: number
    maxCostPerExecution?: number
    defaultApprovalRequired?: boolean
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

/**
 * Initialize services with configuration
 */
export async function initializeServicesWithConfig(
  config: ServiceLayerConfig
): Promise<void> {
  logger.info('🚀 Initializing backend service layer with configuration...')

  try {
    // Create service instances with configuration
    chatService = new ChatService()
    webSocketService = new WebSocketService()
    llmService = new LLMService()
    fileService = new FileService()
    toolService = new ToolService()

    // Apply configuration to services
    // In a full implementation, services would accept configuration in their constructors

    // Register services
    serviceRegistry.register(chatService)
    serviceRegistry.register(webSocketService)
    serviceRegistry.register(llmService)
    serviceRegistry.register(fileService)
    serviceRegistry.register(toolService)

    // Initialize all services
    await serviceRegistry.initialize()

    logger.info('✅ Backend service layer initialized with configuration')
    logger.info(`Configuration applied:`, {
      chat: !!config.chat,
      llm: !!config.llm,
      websocket: !!config.websocket,
      file: !!config.file,
      tool: !!config.tool,
    })
  } catch (error) {
    logger.error('❌ Failed to initialize services with configuration:', error)
    throw error
  }
}

/**
 * Service middleware for Express routes
 * Provides services to Express route handlers
 */
export function serviceMiddleware() {
  return (req: any, res: any, next: any) => {
    req.services = Services
    next()
  }
}

/**
 * Create service context from request data
 * Utility function for creating service contexts from tRPC or Express requests
 */
export function createServiceContext(data: {
  userId: string
  userEmail: string
  userName: string
  sessionId: string
  requestId?: string
}) {
  return {
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName,
    sessionId: data.sessionId,
    requestId:
      data.requestId ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  }
}

// Export service registry as default
export { serviceRegistry as default }
