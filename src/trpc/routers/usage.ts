// Reference: @chat_impl_Plan.md:2084-2100 - Usage tracking patterns
import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { db } from '@/db'
import { usageLogs, conversations } from '@/db/schema'
import { eq, gte, lte, desc, sum, count, and, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

// Input validation schemas
const getUserUsageSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'provider', 'model']).default('day'),
})

const getRecentUsageSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  provider: z.string().optional(),
  conversationId: z.string().uuid().optional(),
})

const logUsageSchema = z.object({
  conversationId: z.string().uuid(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().min(0),
  outputTokens: z.number().min(0),
  cost: z.number().min(0).optional(),
})

const getUsageStatsSchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year']).default('today'),
  provider: z.string().optional(),
})

export const usageRouter = createTRPCRouter({
  // Get usage statistics for user with flexible filtering and grouping
  getUserUsage: protectedProcedure
    .input(getUserUsageSchema)
    .query(async ({ ctx, input }) => {
      let query = db
        .select({
          totalTokens: sql<number>`(${sum(usageLogs.inputTokens)} + ${sum(usageLogs.outputTokens)})`,
          inputTokens: sum(usageLogs.inputTokens),
          outputTokens: sum(usageLogs.outputTokens),
          totalCost: sum(usageLogs.cost),
          requestCount: count(),
          provider: usageLogs.provider,
          model: usageLogs.model,
          date: sql<string>`DATE(${usageLogs.createdAt})`,
        })
        .from(usageLogs)
        .where(eq(usageLogs.userId, ctx.user.id))

      // Add date filters if provided
      if (input.startDate) {
        query = query.where(gte(usageLogs.createdAt, input.startDate))
      }
      if (input.endDate) {
        query = query.where(lte(usageLogs.createdAt, input.endDate))
      }
      if (input.provider) {
        query = query.where(eq(usageLogs.provider, input.provider))
      }
      if (input.model) {
        query = query.where(eq(usageLogs.model, input.model))
      }

      // Group by the specified field
      switch (input.groupBy) {
        case 'provider':
          query = query.groupBy(usageLogs.provider)
          break
        case 'model':
          query = query.groupBy(usageLogs.provider, usageLogs.model)
          break
        case 'day':
          query = query.groupBy(sql`DATE(${usageLogs.createdAt})`)
          break
        case 'week':
          query = query.groupBy(sql`DATE_TRUNC('week', ${usageLogs.createdAt})`)
          break
        case 'month':
          query = query.groupBy(
            sql`DATE_TRUNC('month', ${usageLogs.createdAt})`
          )
          break
      }

      const results = await query.orderBy(desc(usageLogs.createdAt))

      return results.map((result) => ({
        ...result,
        totalTokens: Number(result.totalTokens) || 0,
        inputTokens: Number(result.inputTokens) || 0,
        outputTokens: Number(result.outputTokens) || 0,
        totalCost: Number(result.totalCost) || 0,
        requestCount: Number(result.requestCount) || 0,
      }))
    }),

  // Get recent usage logs with pagination
  getRecentUsage: protectedProcedure
    .input(getRecentUsageSchema)
    .query(async ({ ctx, input }) => {
      let query = db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.userId, ctx.user.id))

      // Add optional filters
      if (input.provider) {
        query = query.where(eq(usageLogs.provider, input.provider))
      }
      if (input.conversationId) {
        query = query.where(eq(usageLogs.conversationId, input.conversationId))
      }

      const logs = await query
        .orderBy(desc(usageLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      return logs
    }),

  // Get usage statistics for different time periods
  getUsageStats: protectedProcedure
    .input(getUsageStatsSchema)
    .query(async ({ ctx, input }) => {
      const now = new Date()
      let startDate: Date

      // Calculate start date based on period
      switch (input.period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
      }

      let query = db
        .select({
          totalTokens: sql<number>`(${sum(usageLogs.inputTokens)} + ${sum(usageLogs.outputTokens)})`,
          inputTokens: sum(usageLogs.inputTokens),
          outputTokens: sum(usageLogs.outputTokens),
          totalCost: sum(usageLogs.cost),
          requestCount: count(),
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.userId, ctx.user.id),
            gte(usageLogs.createdAt, startDate)
          )
        )

      if (input.provider) {
        query = query.where(eq(usageLogs.provider, input.provider))
      }

      const result = await query.then((rows) => rows[0])

      return {
        period: input.period,
        startDate,
        endDate: now,
        totalTokens: Number(result?.totalTokens) || 0,
        inputTokens: Number(result?.inputTokens) || 0,
        outputTokens: Number(result?.outputTokens) || 0,
        totalCost: Number(result?.totalCost) || 0,
        requestCount: Number(result?.requestCount) || 0,
      }
    }),

  // Log usage (internal use - called by provider implementations)
  logUsage: protectedProcedure
    .input(logUsageSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify conversation ownership
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, ctx.user.id)
          )
        )
        .then((rows) => rows[0])

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }

      const usage = await db
        .insert(usageLogs)
        .values({
          userId: ctx.user.id,
          conversationId: input.conversationId,
          provider: input.provider,
          model: input.model,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          cost: input.cost || null,
        })
        .returning()

      return usage[0]
    }),

  // Get usage summary by provider
  getProviderUsageSummary: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

      const results = await db
        .select({
          provider: usageLogs.provider,
          totalTokens: sql<number>`(${sum(usageLogs.inputTokens)} + ${sum(usageLogs.outputTokens)})`,
          inputTokens: sum(usageLogs.inputTokens),
          outputTokens: sum(usageLogs.outputTokens),
          totalCost: sum(usageLogs.cost),
          requestCount: count(),
          avgCostPerRequest: sql<number>`AVG(${usageLogs.cost})`,
          lastUsed: sql<Date>`MAX(${usageLogs.createdAt})`,
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.userId, ctx.user.id),
            gte(usageLogs.createdAt, startDate)
          )
        )
        .groupBy(usageLogs.provider)
        .orderBy(
          desc(
            sql`${sum(usageLogs.inputTokens)} + ${sum(usageLogs.outputTokens)}`
          )
        )

      return results.map((result) => ({
        ...result,
        totalTokens: Number(result.totalTokens) || 0,
        inputTokens: Number(result.inputTokens) || 0,
        outputTokens: Number(result.outputTokens) || 0,
        totalCost: Number(result.totalCost) || 0,
        requestCount: Number(result.requestCount) || 0,
        avgCostPerRequest: Number(result.avgCostPerRequest) || 0,
      }))
    }),

  // Get most used models
  getTopModels: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

      const results = await db
        .select({
          provider: usageLogs.provider,
          model: usageLogs.model,
          totalTokens: sql<number>`(${sum(usageLogs.inputTokens)} + ${sum(usageLogs.outputTokens)})`,
          requestCount: count(),
          totalCost: sum(usageLogs.cost),
          lastUsed: sql<Date>`MAX(${usageLogs.createdAt})`,
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.userId, ctx.user.id),
            gte(usageLogs.createdAt, startDate)
          )
        )
        .groupBy(usageLogs.provider, usageLogs.model)
        .orderBy(desc(count()))
        .limit(input.limit)

      return results.map((result) => ({
        ...result,
        totalTokens: Number(result.totalTokens) || 0,
        requestCount: Number(result.requestCount) || 0,
        totalCost: Number(result.totalCost) || 0,
      }))
    }),

  // Get daily usage trend
  getDailyUsageTrend: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(30),
        provider: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

      let query = db
        .select({
          date: sql<string>`DATE(${usageLogs.createdAt})`,
          totalTokens: sql<number>`(${sum(usageLogs.inputTokens)} + ${sum(usageLogs.outputTokens)})`,
          requestCount: count(),
          totalCost: sum(usageLogs.cost),
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.userId, ctx.user.id),
            gte(usageLogs.createdAt, startDate)
          )
        )

      if (input.provider) {
        query = query.where(eq(usageLogs.provider, input.provider))
      }

      const results = await query
        .groupBy(sql`DATE(${usageLogs.createdAt})`)
        .orderBy(sql`DATE(${usageLogs.createdAt})`)

      return results.map((result) => ({
        ...result,
        totalTokens: Number(result.totalTokens) || 0,
        requestCount: Number(result.requestCount) || 0,
        totalCost: Number(result.totalCost) || 0,
      }))
    }),

  // Get cost breakdown
  getCostBreakdown: protectedProcedure
    .input(
      z.object({
        period: z.enum(['week', 'month', 'year']).default('month'),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date()
      let startDate: Date

      switch (input.period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
      }

      const results = await db
        .select({
          provider: usageLogs.provider,
          model: usageLogs.model,
          totalCost: sum(usageLogs.cost),
          inputTokens: sum(usageLogs.inputTokens),
          outputTokens: sum(usageLogs.outputTokens),
          requestCount: count(),
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.userId, ctx.user.id),
            gte(usageLogs.createdAt, startDate)
          )
        )
        .groupBy(usageLogs.provider, usageLogs.model)
        .orderBy(desc(sum(usageLogs.cost)))

      const totalCost = results.reduce(
        (sum, item) => sum + Number(item.totalCost || 0),
        0
      )

      return {
        period: input.period,
        startDate,
        endDate: now,
        totalCost,
        breakdown: results.map((result) => ({
          ...result,
          totalCost: Number(result.totalCost) || 0,
          inputTokens: Number(result.inputTokens) || 0,
          outputTokens: Number(result.outputTokens) || 0,
          requestCount: Number(result.requestCount) || 0,
          percentage:
            totalCost > 0
              ? (Number(result.totalCost || 0) / totalCost) * 100
              : 0,
        })),
      }
    }),
})
