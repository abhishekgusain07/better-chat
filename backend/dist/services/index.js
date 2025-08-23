'use strict'
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        var desc = Object.getOwnPropertyDescriptor(m, k)
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k]
            },
          }
        }
        Object.defineProperty(o, k2, desc)
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p)
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.default =
  exports.Services =
  exports.llmService =
  exports.webSocketService =
  exports.chatService =
    void 0
exports.initializeServices = initializeServices
exports.cleanupServices = cleanupServices
exports.getServiceHealth = getServiceHealth
exports.getServiceRegistry = getServiceRegistry
exports.initializeServicesWithConfig = initializeServicesWithConfig
exports.serviceMiddleware = serviceMiddleware
exports.createServiceContext = createServiceContext
const service_1 = require('./base/service')
Object.defineProperty(exports, 'default', {
  enumerable: true,
  get: function () {
    return service_1.serviceRegistry
  },
})
const chat_service_1 = require('./chat/chat-service')
const websocket_service_1 = require('./websocket/websocket-service')
const llm_service_1 = require('./llm/llm-service')
const logger_1 = require('@/utils/logger')
__exportStar(require('./types'), exports)
__exportStar(require('./base/service'), exports)
__exportStar(require('./chat/chat-service'), exports)
__exportStar(require('./websocket/websocket-service'), exports)
__exportStar(require('./llm/llm-service'), exports)
async function initializeServices() {
  logger_1.logger.info('🚀 Initializing backend service layer...')
  try {
    exports.chatService = new chat_service_1.ChatService()
    exports.webSocketService = new websocket_service_1.WebSocketService()
    exports.llmService = new llm_service_1.LLMService()
    service_1.serviceRegistry.register(exports.chatService)
    service_1.serviceRegistry.register(exports.webSocketService)
    service_1.serviceRegistry.register(exports.llmService)
    await service_1.serviceRegistry.initialize()
    logger_1.logger.info('✅ Backend service layer initialized successfully')
    logger_1.logger.info(
      `Services available: ${service_1.serviceRegistry.listServices().join(', ')}`
    )
  } catch (error) {
    logger_1.logger.error(
      '❌ Failed to initialize backend service layer:',
      error
    )
    throw error
  }
}
async function cleanupServices() {
  logger_1.logger.info('🧹 Cleaning up backend service layer...')
  try {
    await service_1.serviceRegistry.cleanup()
    logger_1.logger.info('✅ Backend service layer cleanup complete')
  } catch (error) {
    logger_1.logger.error('❌ Error during service cleanup:', error)
  }
}
async function getServiceHealth() {
  try {
    const serviceHealth = await service_1.serviceRegistry.healthCheck()
    const healthy = Object.values(serviceHealth).every(
      (status) => status === true
    )
    return {
      healthy,
      services: serviceHealth,
      timestamp: new Date(),
    }
  } catch (error) {
    logger_1.logger.error('Health check failed:', error)
    return {
      healthy: false,
      services: {},
      timestamp: new Date(),
    }
  }
}
function getServiceRegistry() {
  return service_1.serviceRegistry
}
exports.Services = {
  chat() {
    if (!exports.chatService) {
      throw new Error(
        'ChatService not initialized - call initializeServices() first'
      )
    }
    return exports.chatService
  },
  webSocket() {
    if (!exports.webSocketService) {
      throw new Error(
        'WebSocketService not initialized - call initializeServices() first'
      )
    }
    return exports.webSocketService
  },
  llm() {
    if (!exports.llmService) {
      throw new Error(
        'LLMService not initialized - call initializeServices() first'
      )
    }
    return exports.llmService
  },
  get(serviceName) {
    return service_1.serviceRegistry.get(serviceName)
  },
}
async function initializeServicesWithConfig(config) {
  logger_1.logger.info(
    '🚀 Initializing backend service layer with configuration...'
  )
  try {
    exports.chatService = new chat_service_1.ChatService()
    exports.webSocketService = new websocket_service_1.WebSocketService()
    exports.llmService = new llm_service_1.LLMService()
    service_1.serviceRegistry.register(exports.chatService)
    service_1.serviceRegistry.register(exports.webSocketService)
    service_1.serviceRegistry.register(exports.llmService)
    await service_1.serviceRegistry.initialize()
    logger_1.logger.info(
      '✅ Backend service layer initialized with configuration'
    )
    logger_1.logger.info(`Configuration applied:`, {
      chat: !!config.chat,
      llm: !!config.llm,
      websocket: !!config.websocket,
    })
  } catch (error) {
    logger_1.logger.error(
      '❌ Failed to initialize services with configuration:',
      error
    )
    throw error
  }
}
function serviceMiddleware() {
  return (req, res, next) => {
    req.services = exports.Services
    next()
  }
}
function createServiceContext(data) {
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
//# sourceMappingURL=index.js.map
