import express from 'express'
import { auth } from '@/auth'
import { logger } from '@/utils/logger'

const router = express.Router()

// Note: Authentication now handled entirely by tRPC in Next.js frontend
// Backend routes are trust-based - they assume tRPC has validated the user
// All signup/signin/session-validation is handled in frontend tRPC layer

// Better-auth handlers removed - authentication now handled entirely by tRPC
// Leaving placeholder for any legacy session endpoints that might be called

// Legacy signout endpoint - moved to tRPC
router.post('/signout', async (req, res) => {
  logger.warn(
    'Backend signout endpoint accessed - should use tRPC auth instead'
  )
  res.status(410).json({
    error: 'Endpoint Deprecated',
    message: 'Authentication operations moved to tRPC frontend',
    deprecated: true,
    migration: 'Use tRPC auth.signOut procedure instead',
    timestamp: new Date().toISOString(),
  })
})

// Legacy user info endpoint - will be moved to tRPC
router.get('/me', (req, res) => {
  // This is now a trust-based endpoint - assumes tRPC validated the user
  res.json({
    success: true,
    message: 'User info endpoint moved to tRPC - use frontend authentication',
    deprecated: true,
    redirectTo: 'Use tRPC auth.me procedure instead',
  })
})

export { router as authRoutes }
