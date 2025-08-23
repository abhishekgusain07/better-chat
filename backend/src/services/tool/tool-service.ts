import { BaseService } from '../base/service'
import { ServiceError, ServiceContext } from '../types'
import { nanoid } from 'nanoid'

/**
 * Tool Service Interface
 * Manages AI tool execution with approval workflows and safety
 */
export interface IToolService {
  // Tool execution lifecycle
  requestToolExecution(
    context: ServiceContext,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult>
  approveToolExecution(
    context: ServiceContext,
    executionId: string
  ): Promise<ToolExecutionResult>
  rejectToolExecution(
    context: ServiceContext,
    executionId: string,
    reason?: string
  ): Promise<boolean>
  executeApprovedTool(executionId: string): Promise<ToolExecutionResult>

  // Tool management
  getAvailableTools(): Promise<ToolDefinition[]>
  getToolDefinition(toolName: string): Promise<ToolDefinition | null>
  validateToolParameters(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<ToolValidationResult>

  // Execution tracking
  getToolExecution(executionId: string): Promise<ToolExecutionInfo | null>
  getExecutionHistory(
    context: ServiceContext,
    filters?: ExecutionHistoryFilters
  ): Promise<ToolExecutionInfo[]>
  cancelExecution(
    context: ServiceContext,
    executionId: string
  ): Promise<boolean>

  // Safety and approval
  requiresApproval(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<boolean>
  checkExecutionLimits(
    context: ServiceContext,
    toolName: string
  ): Promise<LimitCheckResult>
  estimateExecutionCost(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<number>

  // Real-time updates
  subscribeToExecutionUpdates(
    executionId: string,
    callback: (update: ToolExecutionUpdate) => void
  ): () => void
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  messageId: string
  conversationId: string
  toolName: string
  parameters: Record<string, unknown>
  requireApproval?: boolean
  metadata?: Record<string, unknown>
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  executionId: string
  status: ToolExecutionStatus
  result?: Record<string, unknown>
  errorMessage?: string
  executionTimeMs?: number
  cost?: number
  approvalRequired?: boolean
  approvalRequestedAt?: Date
  executedAt?: Date
  completedAt?: Date
}

/**
 * Tool execution status
 */
export type ToolExecutionStatus =
  | 'pending'
  | 'approval_required'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rejected'

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string
  description: string
  version: string
  parameters: ToolParameterSchema
  requiresApproval: boolean
  costEstimate?: number
  riskLevel: 'low' | 'medium' | 'high'
  category: string
  examples?: Array<{
    description: string
    parameters: Record<string, unknown>
  }>
}

/**
 * Tool parameter schema
 */
export interface ToolParameterSchema {
  type: 'object'
  properties: Record<
    string,
    {
      type: string
      description: string
      required?: boolean
      enum?: string[]
      default?: unknown
    }
  >
  required: string[]
}

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sanitizedParameters?: Record<string, unknown>
}

/**
 * Tool execution info
 */
export interface ToolExecutionInfo {
  executionId: string
  messageId: string
  conversationId: string
  toolName: string
  parameters: Record<string, unknown>
  status: ToolExecutionStatus
  result?: Record<string, unknown>
  errorMessage?: string
  executionTimeMs?: number
  cost?: number
  approvalRequestedAt?: Date
  approvedAt?: Date
  executedAt?: Date
  completedAt?: Date
  createdAt: Date
}

/**
 * Execution history filters
 */
export interface ExecutionHistoryFilters {
  conversationId?: string
  toolName?: string
  status?: ToolExecutionStatus
  dateFrom?: Date
  dateTo?: Date
  limit?: number
  offset?: number
}

/**
 * Limit check result
 */
export interface LimitCheckResult {
  allowed: boolean
  reason?: string
  remainingExecutions?: number
  resetTime?: Date
}

/**
 * Tool execution update for real-time notifications
 */
export interface ToolExecutionUpdate {
  executionId: string
  status: ToolExecutionStatus
  progress?: number
  message?: string
  result?: Record<string, unknown>
  timestamp: Date
}

/**
 * Tool Service Implementation
 * Provides comprehensive tool execution management with safety and approval workflows
 */
export class ToolService extends BaseService implements IToolService {
  private _availableTools = new Map<string, ToolDefinition>()
  private _executionUpdates = new Map<
    string,
    ((update: ToolExecutionUpdate) => void)[]
  >()
  private _maxExecutionsPerHour: number
  private _maxCostPerExecution: number

  constructor() {
    super('tool-service')
    this._maxExecutionsPerHour = parseInt(
      process.env.MAX_TOOL_EXECUTIONS_PER_HOUR || '50'
    )
    this._maxCostPerExecution = parseFloat(
      process.env.MAX_TOOL_COST_PER_EXECUTION || '10.0'
    )
  }

  async initialize(): Promise<void> {
    this._logger.info('Initializing Tool Service...')

    try {
      // Load available tools
      await this._loadAvailableTools()

      this._logger.info('✅ Tool Service initialized')
      this._logger.info(`🔧 Available tools: ${this._availableTools.size}`)
      this._logger.info(
        `⏱️ Max executions per hour: ${this._maxExecutionsPerHour}`
      )
      this._logger.info(
        `💰 Max cost per execution: $${this._maxCostPerExecution}`
      )
    } catch (error) {
      this._logger.error('❌ Failed to initialize Tool Service:', error)
      throw error
    }
  }

  /**
   * Request tool execution with approval workflow
   */
  async requestToolExecution(
    context: ServiceContext,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    this.logServiceOperation('requestToolExecution', {
      userId: context.userId,
      toolName: request.toolName,
      conversationId: request.conversationId,
      messageId: request.messageId,
    })

    try {
      const executionId = nanoid()

      // Validate tool exists
      const toolDef = await this.getToolDefinition(request.toolName)
      if (!toolDef) {
        throw new ServiceError(
          `Tool not found: ${request.toolName}`,
          'TOOL_NOT_FOUND',
          this.name
        )
      }

      // Validate parameters
      const validation = await this.validateToolParameters(
        request.toolName,
        request.parameters
      )
      if (!validation.valid) {
        throw new ServiceError(
          `Invalid tool parameters: ${validation.errors.join(', ')}`,
          'INVALID_PARAMETERS',
          this.name
        )
      }

      // Check execution limits
      const limitCheck = await this.checkExecutionLimits(
        context,
        request.toolName
      )
      if (!limitCheck.allowed) {
        throw new ServiceError(
          `Execution limit exceeded: ${limitCheck.reason}`,
          'EXECUTION_LIMIT_EXCEEDED',
          this.name
        )
      }

      // Check if approval is required
      const requiresApproval = await this.requiresApproval(
        request.toolName,
        request.parameters
      )

      // Estimate cost
      const estimatedCost = await this.estimateExecutionCost(
        request.toolName,
        request.parameters
      )

      const result: ToolExecutionResult = {
        executionId,
        status: requiresApproval ? 'approval_required' : 'approved',
        approvalRequired: requiresApproval,
        cost: estimatedCost,
      }

      if (requiresApproval) {
        result.approvalRequestedAt = new Date()

        // Emit approval required update
        this._emitExecutionUpdate(executionId, {
          executionId,
          status: 'approval_required',
          message: 'Tool execution requires approval',
          timestamp: new Date(),
        })
      } else {
        // Auto-execute if no approval required
        setTimeout(() => this.executeApprovedTool(executionId), 100)
      }

      return result
    } catch (error) {
      this.logServiceError('requestToolExecution', error as Error)
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            'Tool execution request failed',
            'EXECUTION_REQUEST_FAILED',
            this.name,
            error as Error
          )
    }
  }

  /**
   * Approve tool execution
   */
  async approveToolExecution(
    context: ServiceContext,
    executionId: string
  ): Promise<ToolExecutionResult> {
    this.logServiceOperation('approveToolExecution', {
      userId: context.userId,
      executionId,
    })

    try {
      // TODO: Update execution status in database to 'approved'
      // For now, simulate approval and execute

      const result: ToolExecutionResult = {
        executionId,
        status: 'approved',
        executedAt: new Date(),
      }

      // Emit approval update
      this._emitExecutionUpdate(executionId, {
        executionId,
        status: 'approved',
        message: 'Tool execution approved',
        timestamp: new Date(),
      })

      // Execute the approved tool
      setTimeout(() => this.executeApprovedTool(executionId), 100)

      return result
    } catch (error) {
      this.logServiceError('approveToolExecution', error as Error)
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            'Tool approval failed',
            'APPROVAL_FAILED',
            this.name,
            error as Error
          )
    }
  }

  /**
   * Reject tool execution
   */
  async rejectToolExecution(
    context: ServiceContext,
    executionId: string,
    reason?: string
  ): Promise<boolean> {
    this.logServiceOperation('rejectToolExecution', {
      userId: context.userId,
      executionId,
      reason,
    })

    try {
      // TODO: Update execution status in database to 'rejected'

      // Emit rejection update
      this._emitExecutionUpdate(executionId, {
        executionId,
        status: 'rejected',
        message: reason || 'Tool execution rejected',
        timestamp: new Date(),
      })

      return true
    } catch (error) {
      this.logServiceError('rejectToolExecution', error as Error)
      return false
    }
  }

  /**
   * Execute approved tool
   */
  async executeApprovedTool(executionId: string): Promise<ToolExecutionResult> {
    this.logServiceOperation('executeApprovedTool', { executionId })

    try {
      const startTime = Date.now()

      // Emit execution start update
      this._emitExecutionUpdate(executionId, {
        executionId,
        status: 'executing',
        message: 'Tool execution started',
        progress: 0,
        timestamp: new Date(),
      })

      // TODO: Implement actual tool execution logic
      // This would integrate with specific tool implementations

      // Simulate execution
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const executionTimeMs = Date.now() - startTime
      const mockResult = {
        success: true,
        output: 'Tool execution completed successfully',
        timestamp: new Date().toISOString(),
      }

      const result: ToolExecutionResult = {
        executionId,
        status: 'completed',
        result: mockResult,
        executionTimeMs,
        cost: 0.25, // Mock cost
        completedAt: new Date(),
      }

      // Emit completion update
      this._emitExecutionUpdate(executionId, {
        executionId,
        status: 'completed',
        message: 'Tool execution completed',
        result: mockResult,
        timestamp: new Date(),
      })

      return result
    } catch (error) {
      this.logServiceError('executeApprovedTool', error as Error)

      const result: ToolExecutionResult = {
        executionId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      }

      // Emit failure update
      this._emitExecutionUpdate(executionId, {
        executionId,
        status: 'failed',
        message: result.errorMessage!,
        timestamp: new Date(),
      })

      return result
    }
  }

  /**
   * Get available tools
   */
  async getAvailableTools(): Promise<ToolDefinition[]> {
    return Array.from(this._availableTools.values())
  }

  /**
   * Get tool definition
   */
  async getToolDefinition(toolName: string): Promise<ToolDefinition | null> {
    return this._availableTools.get(toolName) || null
  }

  /**
   * Validate tool parameters
   */
  async validateToolParameters(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<ToolValidationResult> {
    const toolDef = await this.getToolDefinition(toolName)
    if (!toolDef) {
      return {
        valid: false,
        errors: [`Tool not found: ${toolName}`],
        warnings: [],
      }
    }

    const errors: string[] = []
    const warnings: string[] = []

    // Check required parameters
    for (const required of toolDef.parameters.required) {
      if (!(required in parameters)) {
        errors.push(`Missing required parameter: ${required}`)
      }
    }

    // TODO: Add more detailed parameter validation

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedParameters: parameters,
    }
  }

  /**
   * Get tool execution info
   */
  async getToolExecution(
    executionId: string
  ): Promise<ToolExecutionInfo | null> {
    // TODO: Implement database lookup
    return null
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(
    context: ServiceContext,
    filters?: ExecutionHistoryFilters
  ): Promise<ToolExecutionInfo[]> {
    this.logServiceOperation('getExecutionHistory', {
      userId: context.userId,
      filters,
    })

    // TODO: Implement database query with filters
    return []
  }

  /**
   * Cancel execution
   */
  async cancelExecution(
    context: ServiceContext,
    executionId: string
  ): Promise<boolean> {
    this.logServiceOperation('cancelExecution', {
      userId: context.userId,
      executionId,
    })

    try {
      // TODO: Implement execution cancellation logic

      // Emit cancellation update
      this._emitExecutionUpdate(executionId, {
        executionId,
        status: 'cancelled',
        message: 'Tool execution cancelled',
        timestamp: new Date(),
      })

      return true
    } catch (error) {
      this.logServiceError('cancelExecution', error as Error)
      return false
    }
  }

  /**
   * Check if tool requires approval
   */
  async requiresApproval(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<boolean> {
    const toolDef = await this.getToolDefinition(toolName)
    if (!toolDef) return true

    // High-risk tools always require approval
    if (toolDef.riskLevel === 'high') return true

    // Medium-risk tools require approval for certain parameters
    if (toolDef.riskLevel === 'medium') {
      // TODO: Add parameter-based approval logic
      return true
    }

    return toolDef.requiresApproval
  }

  /**
   * Check execution limits
   */
  async checkExecutionLimits(
    context: ServiceContext,
    toolName: string
  ): Promise<LimitCheckResult> {
    // TODO: Implement rate limiting logic
    // For now, always allow
    return {
      allowed: true,
      remainingExecutions: this._maxExecutionsPerHour,
    }
  }

  /**
   * Estimate execution cost
   */
  async estimateExecutionCost(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<number> {
    const toolDef = await this.getToolDefinition(toolName)
    return toolDef?.costEstimate || 0.1
  }

  /**
   * Subscribe to execution updates
   */
  subscribeToExecutionUpdates(
    executionId: string,
    callback: (update: ToolExecutionUpdate) => void
  ): () => void {
    if (!this._executionUpdates.has(executionId)) {
      this._executionUpdates.set(executionId, [])
    }

    this._executionUpdates.get(executionId)!.push(callback)

    // Return cleanup function
    return () => {
      const callbacks = this._executionUpdates.get(executionId)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
        if (callbacks.length === 0) {
          this._executionUpdates.delete(executionId)
        }
      }
    }
  }

  /**
   * Load available tools
   */
  private async _loadAvailableTools(): Promise<void> {
    // Mock tools for now - in production these would be loaded from configuration
    const mockTools: ToolDefinition[] = [
      {
        name: 'file_search',
        description: 'Search through files and directories',
        version: '1.0.0',
        requiresApproval: false,
        riskLevel: 'low',
        category: 'filesystem',
        costEstimate: 0.05,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            path: { type: 'string', description: 'Search path', default: '.' },
          },
          required: ['query'],
        },
      },
      {
        name: 'web_search',
        description: 'Search the web for information',
        version: '1.0.0',
        requiresApproval: true,
        riskLevel: 'medium',
        category: 'web',
        costEstimate: 0.25,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            max_results: {
              type: 'number',
              description: 'Maximum results',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'system_command',
        description: 'Execute system commands',
        version: '1.0.0',
        requiresApproval: true,
        riskLevel: 'high',
        category: 'system',
        costEstimate: 0.5,
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            args: { type: 'array', description: 'Command arguments' },
          },
          required: ['command'],
        },
      },
    ]

    for (const tool of mockTools) {
      this._availableTools.set(tool.name, tool)
    }
  }

  /**
   * Emit execution update to subscribers
   */
  private _emitExecutionUpdate(
    executionId: string,
    update: ToolExecutionUpdate
  ): void {
    const callbacks = this._executionUpdates.get(executionId)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(update)
        } catch (error) {
          this._logger.warn(`Error in execution update callback: ${error}`)
        }
      })
    }
  }

  async cleanup(): Promise<void> {
    this.logServiceOperation('cleanup', {
      activeSubscriptions: this._executionUpdates.size,
    })

    // Clear all subscriptions
    this._executionUpdates.clear()
    this._availableTools.clear()

    await super.cleanup()
  }

  async healthCheck(): Promise<boolean> {
    return this._availableTools.size > 0
  }
}
