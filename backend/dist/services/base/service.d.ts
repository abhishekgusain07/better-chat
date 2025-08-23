export interface IService {
  readonly name: string
  initialize(): Promise<void>
  cleanup(): Promise<void>
  healthCheck(): Promise<boolean>
}
export declare abstract class BaseService implements IService {
  readonly name: string
  protected readonly _logger: import('@/utils/logger').Logger
  constructor(name: string)
  abstract initialize(): Promise<void>
  cleanup(): Promise<void>
  healthCheck(): Promise<boolean>
  protected logServiceOperation(operation: string, data?: any): void
  protected logServiceError(operation: string, error: Error): void
}
export declare class ServiceRegistry {
  private services
  private initialized
  register(service: IService): void
  get<T extends IService>(name: string): T
  initialize(): Promise<void>
  cleanup(): Promise<void>
  healthCheck(): Promise<Record<string, boolean>>
  listServices(): string[]
}
export declare const serviceRegistry: ServiceRegistry
//# sourceMappingURL=service.d.ts.map
