import express from 'express'
import { auth } from '@/auth'
// JWT imports removed - using session-based authentication only
import { authenticateSession, requireAuth } from '@/auth/middleware'
import { logger } from '@/utils/logger'
import { db } from '@/db'
import { z } from 'zod'

const router = express.Router()

// Input validation schemas
const signUpSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Refresh token schema removed - using session-based authentication only

// Mount better-auth handlers for browser-based authentication
router.use('/session', auth.handler)

// API Authentication endpoints for programmatic access

// Sign up with email and password
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = signUpSchema.parse(req.body)

    const result = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    })

    logger.info(`User signed up: ${email}`)

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        emailVerified: result.user.emailVerified,
        image: result.user.image,
      },
      // Session is automatically managed by better-auth cookies
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      })
    }

    logger.error('Sign up error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create account',
      code: 'SIGNUP_FAILED',
    })
  }
})

// Sign in with email and password
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = signInSchema.parse(req.body)

    const result = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    })

    logger.info(`User signed in: ${email}`)

    return res.json({
      success: true,
      message: 'Signed in successfully',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        emailVerified: result.user.emailVerified,
        image: result.user.image,
      },
      // Session is automatically managed by better-auth cookies
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      })
    }

    logger.error('Sign in error:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to sign in',
      code: 'SIGNIN_FAILED',
    })
  }
})

// Refresh token endpoint removed - session-based authentication handles this automatically

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
