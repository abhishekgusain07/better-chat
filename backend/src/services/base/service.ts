import { logger } from '@/utils/logger'

/**
 * Base Service Interface - all backend services implement this
 * Services operate without direct database access - tRPC provides data
 */
export interface IService {
  readonly name: string
  initialize(): Promise<void>
  cleanup(): Promise<void>
  healthCheck(): Promise<boolean>
}

/**
 * Base Service Class - provides common functionality for all services
 * Designed for tRPC-First architecture where services are stateless
 */
export abstract class BaseService implements IService {
  protected readonly _logger = logger

  constructor(public readonly name: string) {}

  abstract initialize(): Promise<void>

  async cleanup(): Promise<void> {
    this._logger.info(`Service ${this.name} cleaning up`)
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  protected logServiceOperation(operation: string, data?: any): void {
    this._logger.debug(`[${this.name}] ${operation}`, data)
  }

  protected logServiceError(operation: string, error: Error): void {
    this._logger.error(`[${this.name}] ${operation} failed:`, error)
  }
}

/**
 * Service Registry - manages all backend services
 * Provides dependency injection and service lifecycle management
 */
export class ServiceRegistry {
  private services = new Map<string, IService>()
  private initialized = false

  register(service: IService): void {
    if (this.initialized) {
      throw new Error('Cannot register services after initialization')
    }
    this.services.set(service.name, service)
    logger.debug(`Service registered: ${service.name}`)
  }

  get<T extends IService>(name: string): T {
    const service = this.services.get(name) as T
    if (!service) {
      throw new Error(`Service not found: ${name}`)
    }
    return service
  }

  async initialize(): Promise<void> {
    logger.info('Initializing service registry...')

    for (const [name, service] of this.services) {
      try {
        await service.initialize()
        logger.info(`✅ Service initialized: ${name}`)
      } catch (error) {
        logger.error(`❌ Failed to initialize service: ${name}`, error)
        throw error
      }
    }

    this.initialized = true
    logger.info(
      `Service registry initialized with ${this.services.size} services`
    )
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up services...')

    for (const [name, service] of this.services) {
      try {
        await service.cleanup()
        logger.debug(`Service cleaned up: ${name}`)
      } catch (error) {
        logger.error(`Failed to cleanup service: ${name}`, error)
      }
    }

    this.initialized = false
    logger.info('Service registry cleanup complete')
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {}

    for (const [name, service] of this.services) {
      try {
        health[name] = await service.healthCheck()
      } catch (error) {
        logger.error(`Health check failed for service: ${name}`, error)
        health[name] = false
      }
    }

    return health
  }

  listServices(): string[] {
    return Array.from(this.services.keys())
  }
}

// Global service registry instance
export const serviceRegistry = new ServiceRegistry()
