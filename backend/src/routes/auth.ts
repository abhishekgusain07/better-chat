import express from 'express'
import { auth } from '@/auth'
import { authenticateSession, requireAuth } from '@/auth/middleware'
import { logger } from '@/utils/logger'

const router = express.Router()

// Note: Signup/Signin endpoints removed - handled by Next.js frontend in hybrid architecture
// Backend only handles session validation and authentication middleware

// Mount better-auth handlers for browser-based authentication
router.use('/session', auth.handler)

// Session validation endpoints only - signup/signin handled by Next.js frontend

// Sign out (for session-based auth)
router.post('/signout', authenticateSession, async (req, res) => {
  try {
    if (req.session) {
      await auth.api.signOut({
        headers: req.headers as any,
      })
    }

    res.json({
      success: true,
      message: 'Signed out successfully',
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

// Get current user (requires authentication)
router.get('/me', authenticateSession, requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
      emailVerified: req.user!.emailVerified,
      image: req.user!.image,
    },
    session: req.session,
  })
})

export { router as authRoutes }
