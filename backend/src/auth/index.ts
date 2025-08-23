import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import { user, account, session, verification } from '@/db/schema'
import { env } from '@/env'
import { logger } from '@/utils/logger'

// Better-auth configuration for Express backend
// NOTE: Most auth now handled by tRPC in frontend - this is legacy support
// TODO: Remove this in Phase 1.2 when backend database access is removed
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      account,
      session,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.NODE_ENV === 'production',
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 30 * 60, // 30 minutes
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: env.NODE_ENV === 'production',
    },
    generateId: false, // Use nanoid in endpoints
  },
  trustedOrigins: env.ALLOWED_ORIGINS,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  // Add additional security options
  rateLimit: {
    enabled: true,
    window: 60 * 1000, // 1 minute
    max: 10, // 10 requests per window
  },

  // Note: Custom callbacks would be configured here if supported by the version
  // callbacks: {
  //   async userCreated({ user }) {
  //     logger.info(`New user created: ${user.email}`)
  //   },
  //   async sessionCreated({ session, user }) {
  //     logger.info(`New session created for user: ${user.email}`)
  //   },
  // },
})

// Export basic types for use in other files
export interface AuthUser {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AuthSession {
  id: string
  userId: string
  expiresAt: Date
  token: string
  createdAt: Date
  updatedAt: Date
}
