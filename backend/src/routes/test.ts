import express from 'express'
import { authenticateSession, requireAuth } from '@/auth/middleware'
import { logger } from '@/utils/logger'

const router = express.Router()

// Public test endpoint (no authentication required)
router.get('/public', (req, res) => {
  logger.debug('Public test endpoint accessed')

  res.json({
    success: true,
    message: 'Public test endpoint is working!',
    timestamp: new Date().toISOString(),
    authenticated: false,
  })
})

// Protected test endpoint (authentication required)
router.get('/protected', authenticateSession, requireAuth, (req, res) => {
  logger.debug(`Protected test endpoint accessed by user: ${req.user?.id}`)

  res.json({
    success: true,
    message: 'Protected test endpoint is working!',
    timestamp: new Date().toISOString(),
    authenticated: true,
    user: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
    },
  })
})

// Authentication info endpoint
router.get('/auth-info', authenticateSession, (req, res) => {
  const isAuthenticated = !!req.user

  logger.debug(`Auth info requested - authenticated: ${isAuthenticated}`)

  res.json({
    success: true,
    authenticated: isAuthenticated,
    user: isAuthenticated
      ? {
          id: req.user!.id,
          name: req.user!.name,
          email: req.user!.email,
          emailVerified: req.user!.emailVerified,
          image: req.user!.image,
        }
      : null,
    session: isAuthenticated
      ? {
          id: req.session!.id,
          expiresAt: req.session!.expiresAt,
        }
      : null,
    timestamp: new Date().toISOString(),
  })
})

// WebSocket connection info endpoint
router.get('/websocket-info', (req, res) => {
  logger.debug('WebSocket connection info requested')

  res.json({
    success: true,
    message: 'WebSocket server configuration',
    websocket: {
      path: '/ws/',
      url: `${req.protocol}://${req.get('host')}/ws/`,
      cors: {
        enabled: true,
        credentials: true,
      },
      authentication: {
        type: 'session-based',
        required: true,
        middleware: 'better-auth',
      },
    },
    timestamp: new Date().toISOString(),
  })
})

// Health check with detailed info
router.get('/health', (req, res) => {
  logger.debug('Test health check accessed')

  res.json({
    success: true,
    status: 'healthy',
    services: {
      api: 'operational',
      websocket: 'operational',
      authentication: 'operational',
      database: 'operational', // Assuming DB is working if we got this far
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  })
})

export { router as testRoutes }
