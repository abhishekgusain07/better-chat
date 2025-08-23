import express from 'express'
import { auth } from '@/auth'
import { logger } from '@/utils/logger'

const router = express.Router()

// Note: Authentication now handled entirely by tRPC in Next.js frontend
// Backend routes are trust-based - they assume tRPC has validated the user
// All signup/signin/session-validation is handled in frontend tRPC layer

// Mount better-auth handlers for browser-based authentication (legacy support)
router.use('/session', auth.handler)

// Legacy signout endpoint - will be moved to tRPC
router.post('/signout', async (req, res) => {
  try {
    // Basic signout without session validation (tRPC handles auth)
    await auth.api.signOut({
      headers: req.headers as any,
    })

    res.json({
      success: true,
      message: 'Signed out successfully (legacy endpoint)',
    })
  } catch (error) {
    logger.error('Sign out error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to sign out',
      code: 'SIGNOUT_FAILED',
    })
  }
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
