// Tools Router - integrates with backend tool service layer
import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { db } from '@/db'
import { toolExecutions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { createServiceContext } from '../../../backend/src/services'
import type {
  ToolExecutionRequest,
  ToolExecutionUpdate,
} from '../../../backend/src/services/tool/tool-service'

// Input validation schemas
const requestExecutionSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  toolName: z.string().min(1).max(100),
  parameters: z.record(z.unknown()),
  requireApproval: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const approveExecutionSchema = z.object({
  executionId: z.string(),
})

const rejectExecutionSchema = z.object({
  executionId: z.string(),
  reason: z.string().optional(),
})

const getExecutionSchema = z.object({
  executionId: z.string(),
})

const cancelExecutionSchema = z.object({
  executionId: z.string(),
})

const getHistorySchema = z.object({
  conversationId: z.string().uuid().optional(),
  toolName: z.string().optional(),
  status: z
    .enum([
      'pending',
      'approval_required',
      'approved',
      'executing',
      'completed',
      'failed',
      'cancelled',
      'rejected',
    ])
    .optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
})

const subscribeToExecutionSchema = z.object({
  executionId: z.string(),
})

const validateParametersSchema = z.object({
  toolName: z.string().min(1).max(100),
  parameters: z.record(z.unknown()),
})

export const toolsRouter = createTRPCRouter({
  // Request tool execution
  requestExecution: protectedProcedure
    .input(requestExecutionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { Services } = await import('../../../backend/src/services')
        const toolService = Services.tool()

        // Create service context
        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId || 'unknown',
        })

        // Prepare execution request
        const executionRequest: ToolExecutionRequest = {
          messageId: input.messageId,
          conversationId: input.conversationId,
          toolName: input.toolName,
          parameters: input.parameters,
          requireApproval: input.requireApproval,
          metadata: input.metadata,
        }

        // Request execution via service
        const result = await toolService.requestToolExecution(
          serviceContext,
          executionRequest
        )

        // Save execution record to database
        const executionRecord = await db
          .insert(toolExecutions)
          .values({
            id: result.executionId,
            messageId: input.messageId,
            conversationId: input.conversationId,
            toolName: input.toolName,
            parameters: input.parameters,
            status: result.status,
            approvalRequestedAt: result.approvalRequestedAt,
            cost: result.cost ? result.cost.toString() : undefined,
          })
          .returning()

        return {
          ...result,
          createdAt: executionRecord[0].createdAt,
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('TOOL_NOT_FOUND')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Tool not found',
            })
          }
          if (error.message.includes('INVALID_PARAMETERS')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid tool parameters',
            })
          }
          if (error.message.includes('EXECUTION_LIMIT_EXCEEDED')) {
            throw new TRPCError({
              code: 'TOO_MANY_REQUESTS',
              message: 'Execution limit exceeded',
            })
          }
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tool execution request failed',
        })
      }
    }),

  // Approve tool execution
  approveExecution: protectedProcedure
    .input(approveExecutionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify execution ownership
        const executionRecord = await db
          .select()
          .from(toolExecutions)
          .where(eq(toolExecutions.id, input.executionId))
          .then((rows) => rows[0])

        if (!executionRecord) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Execution not found',
          })
        }

        // Verify conversation ownership (indirectly verifies execution ownership)
        // TODO: Add conversation ownership check

        const { Services } = await import('../../../backend/src/services')
        const toolService = Services.tool()

        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId || 'unknown',
        })

        // Approve execution via service
        const result = await toolService.approveToolExecution(
          serviceContext,
          input.executionId
        )

        // Update database record
        await db
          .update(toolExecutions)
          .set({
            status: result.status,
            approvedAt: result.executedAt,
          })
          .where(eq(toolExecutions.id, input.executionId))

        return result
      } catch (error) {
        if (error instanceof TRPCError) throw error

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tool approval failed',
        })
      }
    }),

  // Reject tool execution
  rejectExecution: protectedProcedure
    .input(rejectExecutionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify execution ownership
        const executionRecord = await db
          .select()
          .from(toolExecutions)
          .where(eq(toolExecutions.id, input.executionId))
          .then((rows) => rows[0])

        if (!executionRecord) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Execution not found',
          })
        }

        const { Services } = await import('../../../backend/src/services')
        const toolService = Services.tool()

        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId || 'unknown',
        })

        // Reject execution via service
        const success = await toolService.rejectToolExecution(
          serviceContext,
          input.executionId,
          input.reason
        )

        if (success) {
          // Update database record
          await db
            .update(toolExecutions)
            .set({
              status: 'rejected',
              errorMessage: input.reason || 'Rejected by user',
              completedAt: new Date(),
            })
            .where(eq(toolExecutions.id, input.executionId))

          return { success: true }
        } else {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to reject execution',
          })
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tool rejection failed',
        })
      }
    }),

  // Get tool execution details
  getExecution: protectedProcedure
    .input(getExecutionSchema)
    .query(async ({ ctx, input }) => {
      const executionRecord = await db
        .select()
        .from(toolExecutions)
        .where(eq(toolExecutions.id, input.executionId))
        .then((rows) => rows[0])

      if (!executionRecord) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Execution not found',
        })
      }

      // TODO: Verify user has access to this execution (through conversation ownership)

      return {
        executionId: executionRecord.id,
        messageId: executionRecord.messageId,
        conversationId: executionRecord.conversationId,
        toolName: executionRecord.toolName,
        parameters: executionRecord.parameters,
        result: executionRecord.result,
        status: executionRecord.status,
        errorMessage: executionRecord.errorMessage,
        executionTimeMs: executionRecord.executionTimeMs,
        cost: executionRecord.cost
          ? parseFloat(executionRecord.cost)
          : undefined,
        approvalRequestedAt: executionRecord.approvalRequestedAt,
        approvedAt: executionRecord.approvedAt,
        executedAt: executionRecord.executedAt,
        completedAt: executionRecord.completedAt,
        createdAt: executionRecord.createdAt,
      }
    }),

  // Cancel execution
  cancelExecution: protectedProcedure
    .input(cancelExecutionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { Services } = await import('../../../backend/src/services')
        const toolService = Services.tool()

        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId || 'unknown',
        })

        // Cancel execution via service
        const success = await toolService.cancelExecution(
          serviceContext,
          input.executionId
        )

        if (success) {
          // Update database record
          await db
            .update(toolExecutions)
            .set({
              status: 'cancelled',
              completedAt: new Date(),
            })
            .where(eq(toolExecutions.id, input.executionId))

          return { success: true }
        } else {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to cancel execution',
          })
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tool cancellation failed',
        })
      }
    }),

  // Get execution history
  getHistory: protectedProcedure
    .input(getHistorySchema)
    .query(async ({ ctx, input }) => {
      let query = db.select().from(toolExecutions)

      // TODO: Add proper user access control through conversation ownership

      // Add conversation filter if specified
      if (input.conversationId) {
        query = query.where(
          eq(toolExecutions.conversationId, input.conversationId)
        )
      }

      // Add tool name filter if specified
      if (input.toolName) {
        query = query.where(eq(toolExecutions.toolName, input.toolName))
      }

      // Add status filter if specified
      if (input.status) {
        query = query.where(eq(toolExecutions.status, input.status))
      }

      const executions = await query
        .orderBy(desc(toolExecutions.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      return executions.map((execution) => ({
        executionId: execution.id,
        messageId: execution.messageId,
        conversationId: execution.conversationId,
        toolName: execution.toolName,
        parameters: execution.parameters,
        result: execution.result,
        status: execution.status,
        errorMessage: execution.errorMessage,
        executionTimeMs: execution.executionTimeMs,
        cost: execution.cost ? parseFloat(execution.cost) : undefined,
        approvalRequestedAt: execution.approvalRequestedAt,
        approvedAt: execution.approvedAt,
        executedAt: execution.executedAt,
        completedAt: execution.completedAt,
        createdAt: execution.createdAt,
      }))
    }),

  // Subscribe to execution updates
  subscribeToExecution: protectedProcedure
    .input(subscribeToExecutionSchema)
    .subscription(async ({ ctx, input }) => {
      // Verify execution access
      const executionRecord = await db
        .select()
        .from(toolExecutions)
        .where(eq(toolExecutions.id, input.executionId))
        .then((rows) => rows[0])

      if (!executionRecord) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Execution not found',
        })
      }

      return observable<ToolExecutionUpdate>((emit) => {
        let cleanup: (() => void) | null = null

        const initializeSubscription = async () => {
          try {
            const { Services } = await import('../../../backend/src/services')
            const toolService = Services.tool()

            // Subscribe to execution updates via service
            cleanup = toolService.subscribeToExecutionUpdates(
              input.executionId,
              (update: ToolExecutionUpdate) => {
                emit.next(update)
              }
            )
          } catch (error) {
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to subscribe to execution updates',
              })
            )
          }
        }

        initializeSubscription()

        // Cleanup function
        return () => {
          if (cleanup) {
            cleanup()
          }
        }
      })
    }),

  // Get available tools
  getAvailableTools: protectedProcedure.query(async () => {
    try {
      const { Services } = await import('../../../backend/src/services')
      const toolService = Services.tool()

      const tools = await toolService.getAvailableTools()
      return tools
    } catch {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get available tools',
      })
    }
  }),

  // Get tool definition
  getToolDefinition: protectedProcedure
    .input(z.object({ toolName: z.string() }))
    .query(async ({ input }) => {
      try {
        const { Services } = await import('../../../backend/src/services')
        const toolService = Services.tool()

        const toolDef = await toolService.getToolDefinition(input.toolName)

        if (!toolDef) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tool not found',
          })
        }

        return toolDef
      } catch (error) {
        if (error instanceof TRPCError) throw error

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get tool definition',
        })
      }
    }),

  // Validate tool parameters
  validateParameters: protectedProcedure
    .input(validateParametersSchema)
    .mutation(async ({ input }) => {
      try {
        const { Services } = await import('../../../backend/src/services')
        const toolService = Services.tool()

        const validation = await toolService.validateToolParameters(
          input.toolName,
          input.parameters
        )
        return validation
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Parameter validation failed',
        })
      }
    }),

  // Get tool service health
  getToolServiceHealth: protectedProcedure.query(async () => {
    try {
      const { Services } = await import('../../../backend/src/services')
      const toolService = Services.tool()

      const isHealthy = await toolService.healthCheck()
      const availableTools = await toolService.getAvailableTools()

      return {
        healthy: isHealthy,
        availableTools: availableTools.length,
        service: 'Tool Service via tRPC',
        timestamp: new Date(),
      }
    } catch {
      return {
        healthy: false,
        availableTools: 0,
        service: 'Tool Service Unavailable',
        timestamp: new Date(),
      }
    }
  }),

  // Get execution statistics
  getExecutionStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      // TODO: Add proper user access control through conversation ownership
      const stats = await db.select().from(toolExecutions)

      const totalExecutions = stats.length
      const completedExecutions = stats.filter(
        (e) => e.status === 'completed'
      ).length
      const failedExecutions = stats.filter((e) => e.status === 'failed').length
      const pendingApproval = stats.filter(
        (e) => e.status === 'approval_required'
      ).length

      // Calculate total cost
      const totalCost = stats.reduce((sum, execution) => {
        const cost = execution.cost ? parseFloat(execution.cost) : 0
        return sum + cost
      }, 0)

      // Group by tool name
      const toolStats = stats.reduce(
        (acc, execution) => {
          acc[execution.toolName] = (acc[execution.toolName] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      return {
        totalExecutions,
        completedExecutions,
        failedExecutions,
        pendingApproval,
        totalCost: Math.round(totalCost * 100) / 100, // Round to 2 decimal places
        successRate:
          totalExecutions > 0
            ? Math.round((completedExecutions / totalExecutions) * 100)
            : 0,
        toolStats,
      }
    } catch {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get execution stats',
      })
    }
  }),
})
