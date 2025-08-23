import { initTRPC, TRPCError } from '@trpc/server'
import { experimental_nextAppDirCaller } from '@trpc/server/adapters/next-app-dir'
import superjson from 'superjson'
import { cache } from 'react'
import { ZodError } from 'zod'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { logger } from '@/utils/logger'

// Enhanced session management with comprehensive error handling
const getCurrentSession = cache(async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (session?.user) {
      logger.debug(`tRPC session validated for user: ${session.user.email}`)
    }

    return session
  } catch (error) {
    logger.debug('tRPC session validation failed:', error)
    return null
  }
})

// Enhanced tRPC context - SINGLE SOURCE OF AUTHENTICATION TRUTH
export const createTRPCContext = cache(async () => {
  const session = await getCurrentSession()

  // Enhanced context with authentication metadata
  return {
    session,
    user: session?.user || null,
    isAuthenticated: !!session?.user,
    userId: session?.user?.id || null,
    userEmail: session?.user?.email || null,
    sessionId: session?.session?.id || null,
    // Add timing for performance monitoring
    requestTimestamp: new Date(),
  }
})

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

// Meta interface for server actions
interface Meta {
  span: string
}

const t = initTRPC
  .context<TRPCContext>()
  .meta<Meta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      }
    },
  })

// Base router and procedure helpers
export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

// Base procedure
export const baseProcedure = t.procedure

// Server action procedure with experimental caller
export const serverActionProcedure = t.procedure.experimental_caller(
  experimental_nextAppDirCaller({
    pathExtractor: ({ meta }) => (meta as Meta).span,
    createContext: createTRPCContext,
  })
)

// Enhanced protected procedure - SINGLE AUTHENTICATION LAYER
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const startTime = Date.now()

  if (!ctx.isAuthenticated || !ctx.user || !ctx.userId) {
    logger.warn(
      `Unauthorized tRPC access attempt from IP: ${ctx.requestTimestamp}`
    )
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required - please sign in to continue',
      cause: 'NO_SESSION',
    })
  }

  if (!ctx.session?.session) {
    logger.warn(`Invalid session state for user: ${ctx.userEmail}`)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Session expired - please sign in again',
      cause: 'INVALID_SESSION',
    })
  }

  logger.debug(
    `tRPC procedure authenticated for user: ${ctx.userEmail} (${ctx.userId})`
  )

  const result = await next({
    ctx: {
      ...ctx,
      user: ctx.user, // Ensures user is non-nullable
      userId: ctx.userId as string, // Ensures userId is non-nullable
    },
  })

  // Log performance metrics
  const duration = Date.now() - startTime
  if (duration > 1000) {
    logger.warn(
      `Slow tRPC procedure (${duration}ms) for user: ${ctx.userEmail}`
    )
  }

  return result
})

// Enhanced protected server action procedure
export const protectedServerAction = serverActionProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.isAuthenticated || !ctx.user || !ctx.userId) {
      logger.warn(`Unauthorized server action attempt`)
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required for server actions',
        cause: 'NO_SESSION',
      })
    }

    logger.debug(`Server action authenticated for user: ${ctx.userEmail}`)

    return next({
      ctx: {
        ...ctx,
        user: ctx.user, // Ensures user is non-nullable
        userId: ctx.userId as string, // Ensures userId is non-nullable
      },
    })
  }
)

// Admin procedure for elevated permissions (future use)
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // For now, all authenticated users have access
  // In future: check ctx.user.role === 'admin' or similar
  logger.debug(`Admin procedure access for user: ${ctx.userEmail}`)

  return next({
    ctx: {
      ...ctx,
      isAdmin: true, // Future: derive from user.role
    },
  })
})
