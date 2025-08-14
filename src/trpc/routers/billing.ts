import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { subscription } from '@/db/schema'
import { getUserPlan, getPlanLimits, PRICING_PLANS } from '@/lib/plans'
import { createTRPCRouter, protectedProcedure } from '../init'

export const billingRouter = createTRPCRouter({
  // Get current user's subscription and billing data
  getCurrentSubscription: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Fetch subscription from database
      const userSubscription = await db
        .select()
        .from(subscription)
        .where(eq(subscription.userId, ctx.user.id))
        .orderBy(desc(subscription.createdAt))
        .limit(1)
        .then((rows) => rows[0] || null)

      // Get plan information
      const currentPlan = getUserPlan(userSubscription)
      const planLimits = getPlanLimits(currentPlan)
      const currentPricingPlan = PRICING_PLANS.find(
        (p) => p.title.toLowerCase() === currentPlan
      )

      // Mock usage data - in real app, this would come from usage tracking
      const currentUsage = {
        users: 1,
        projects: 0,
        apiCalls: 0,
      }

      const usagePercentages = {
        users:
          planLimits.maxUsers === -1
            ? 0
            : (currentUsage.users / planLimits.maxUsers) * 100,
        projects:
          planLimits.maxProjects === -1
            ? 0
            : (currentUsage.projects / planLimits.maxProjects) * 100,
        apiCalls:
          planLimits.maxApiCalls === -1
            ? 0
            : (currentUsage.apiCalls / planLimits.maxApiCalls) * 100,
      }

      return {
        subscription: userSubscription
          ? {
              ...userSubscription,
              currentPeriodStart:
                userSubscription.currentPeriodStart.toISOString(),
              currentPeriodEnd: userSubscription.currentPeriodEnd.toISOString(),
              canceledAt: userSubscription.canceledAt?.toISOString() || null,
              endsAt: userSubscription.endsAt?.toISOString() || null,
              endedAt: userSubscription.endedAt?.toISOString() || null,
              createdAt: userSubscription.createdAt.toISOString(),
              updatedAt: userSubscription.updatedAt.toISOString(),
            }
          : null,
        currentPlan,
        planLimits,
        currentPricingPlan,
        currentUsage,
        usagePercentages,
      }
    } catch (error) {
      console.error('Error fetching billing data:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch billing information',
      })
    }
  }),

  // Get usage statistics
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      // This would typically fetch from your usage tracking system
      // For now, returning mock data
      return {
        users: 1,
        projects: 0,
        apiCalls: 0,
        period: {
          start: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ).toISOString(),
          end: new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error('Error fetching usage stats:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch usage statistics',
      })
    }
  }),

  // Open customer portal
  openCustomerPortal: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Get user's subscription
      const userSubscription = await db
        .select()
        .from(subscription)
        .where(eq(subscription.userId, ctx.user.id))
        .orderBy(desc(subscription.createdAt))
        .limit(1)
        .then((rows) => rows[0] || null)

      if (!userSubscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active subscription found',
        })
      }

      // In a real implementation, you would create a customer portal session with Polar
      // For now, we'll return a placeholder URL
      const portalUrl = `https://polar.sh/customer-portal?customer_id=${userSubscription.polarId}`

      return {
        url: portalUrl,
        success: true,
      }
    } catch (error) {
      console.error('Error opening customer portal:', error)

      if (error instanceof TRPCError) {
        throw error
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to open customer portal',
      })
    }
  }),

  // Cancel subscription
  cancelSubscription: protectedProcedure
    .input(
      z.object({
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx }) => {
      try {
        // Get user's subscription
        const userSubscription = await db
          .select()
          .from(subscription)
          .where(eq(subscription.userId, ctx.user.id))
          .orderBy(desc(subscription.createdAt))
          .limit(1)
          .then((rows) => rows[0] || null)

        if (!userSubscription) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No active subscription found',
          })
        }

        if (userSubscription.status !== 'active') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Subscription is not active',
          })
        }

        // In a real implementation, you would call Polar API to cancel the subscription
        // For now, we'll just update the database
        await db
          .update(subscription)
          .set({
            cancelAtPeriodEnd: true,
            canceledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscription.id, userSubscription.id))

        return {
          success: true,
          message: 'Subscription scheduled for cancellation at period end',
        }
      } catch (error) {
        console.error('Error cancelling subscription:', error)

        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel subscription',
        })
      }
    }),

  // Reactivate subscription
  reactivateSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Get user's subscription
      const userSubscription = await db
        .select()
        .from(subscription)
        .where(eq(subscription.userId, ctx.user.id))
        .orderBy(desc(subscription.createdAt))
        .limit(1)
        .then((rows) => rows[0] || null)

      if (!userSubscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No subscription found',
        })
      }

      if (!userSubscription.cancelAtPeriodEnd) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Subscription is not scheduled for cancellation',
        })
      }

      // In a real implementation, you would call Polar API to reactivate the subscription
      // For now, we'll just update the database
      await db
        .update(subscription)
        .set({
          cancelAtPeriodEnd: false,
          canceledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(subscription.id, userSubscription.id))

      return {
        success: true,
        message: 'Subscription reactivated successfully',
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error)

      if (error instanceof TRPCError) {
        throw error
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reactivate subscription',
      })
    }
  }),
})
