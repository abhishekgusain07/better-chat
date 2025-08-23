import { BaseService } from '../base/service'
import {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMProviderConfig,
} from '../types'
export interface ILLMProvider {
  name: string
  initialize(config: LLMProviderConfig): Promise<void>
  generateResponse(request: LLMRequest): Promise<LLMResponse>
  streamResponse(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse>
  healthCheck(): Promise<boolean>
}
export interface ILLMService {
  addProvider(provider: ILLMProvider, config: LLMProviderConfig): Promise<void>
  getProvider(name: string): ILLMProvider | null
  listProviders(): string[]
  generateResponse(request: LLMRequest): Promise<LLMResponse>
  streamResponse(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse>
  validateRequest(request: LLMRequest): boolean
  estimateTokens(content: string): number
}
export declare class MockLLMProvider implements ILLMProvider {
  name: string
  private config
  initialize(config: LLMProviderConfig): Promise<void>
  generateResponse(request: LLMRequest): Promise<LLMResponse>
  streamResponse(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse>
  healthCheck(): Promise<boolean>
  private _generateMockResponse
  private _estimateTokens
}
export declare class LLMService extends BaseService implements ILLMService {
  private _providers
  constructor()
  initialize(): Promise<void>
  addProvider(provider: ILLMProvider, config: LLMProviderConfig): Promise<void>
  getProvider(name: string): ILLMProvider | null
  listProviders(): string[]
  generateResponse(request: LLMRequest): Promise<LLMResponse>
  streamResponse(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse>
  validateRequest(request: LLMRequest): boolean
  estimateTokens(content: string): number
  cleanup(): Promise<void>
  healthCheck(): Promise<boolean>
}
//# sourceMappingURL=llm-service.d.ts.map
