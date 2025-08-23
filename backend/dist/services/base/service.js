'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.serviceRegistry = exports.ServiceRegistry = exports.BaseService = void 0
const logger_1 = require('@/utils/logger')
class BaseService {
  name
  _logger = logger_1.logger
  constructor(name) {
    this.name = name
  }
  async cleanup() {
    this._logger.info(`Service ${this.name} cleaning up`)
  }
  async healthCheck() {
    return true
  }
  logServiceOperation(operation, data) {
    this._logger.debug(`[${this.name}] ${operation}`, data)
  }
  logServiceError(operation, error) {
    this._logger.error(`[${this.name}] ${operation} failed:`, error)
  }
}
exports.BaseService = BaseService
class ServiceRegistry {
  services = new Map()
  initialized = false
  register(service) {
    if (this.initialized) {
      throw new Error('Cannot register services after initialization')
    }
    this.services.set(service.name, service)
    logger_1.logger.debug(`Service registered: ${service.name}`)
  }
  get(name) {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service not found: ${name}`)
    }
    return service
  }
  async initialize() {
    logger_1.logger.info('Initializing service registry...')
    for (const [name, service] of this.services) {
      try {
        await service.initialize()
        logger_1.logger.info(`✅ Service initialized: ${name}`)
      } catch (error) {
        logger_1.logger.error(`❌ Failed to initialize service: ${name}`, error)
        throw error
      }
    }
    this.initialized = true
    logger_1.logger.info(
      `Service registry initialized with ${this.services.size} services`
    )
  }
  async cleanup() {
    logger_1.logger.info('Cleaning up services...')
    for (const [name, service] of this.services) {
      try {
        await service.cleanup()
        logger_1.logger.debug(`Service cleaned up: ${name}`)
      } catch (error) {
        logger_1.logger.error(`Failed to cleanup service: ${name}`, error)
      }
    }
    this.initialized = false
    logger_1.logger.info('Service registry cleanup complete')
  }
  async healthCheck() {
    const health = {}
    for (const [name, service] of this.services) {
      try {
        health[name] = await service.healthCheck()
      } catch (error) {
        logger_1.logger.error(`Health check failed for service: ${name}`, error)
        health[name] = false
      }
    }
    return health
  }
  listServices() {
    return Array.from(this.services.keys())
  }
}
exports.ServiceRegistry = ServiceRegistry
exports.serviceRegistry = new ServiceRegistry()
//# sourceMappingURL=service.js.map
