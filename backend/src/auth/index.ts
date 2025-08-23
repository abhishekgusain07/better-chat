import { logger } from '@/utils/logger'

// Backend auth completely removed - all authentication handled by tRPC in frontend
// This file maintained only for legacy route compatibility

// Placeholder auth object for legacy routes
export const auth = {
  api: {
    signOut: async (options: any) => {
      logger.warn(
        'Backend signOut called - should use tRPC frontend auth instead'
      )
      throw new Error(
        'Authentication moved to tRPC frontend - use frontend signout'
      )
    },
  },
}

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
