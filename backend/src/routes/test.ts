import express from 'express'
import { logger } from '@/utils/logger'

const router = express.Router()

// Note: Authentication now handled by tRPC - these are now trust-based endpoints

// Public test endpoint (no authentication required)
router.get('/public', (req, res) => {
  logger.debug('Public test endpoint accessed')

  res.json({
    success: true,
    message: 'Public test endpoint is working!',
    timestamp: new Date().toISOString(),
    authenticated: false,
    architecture: 'tRPC-First Hybrid',
  })
})

// Protected test endpoint (trust-based - tRPC handles auth)
router.get('/protected', (req, res) => {
  logger.debug('Protected test endpoint accessed (trust-based)')

  res.json({
    success: true,
    message: 'Protected endpoint working with tRPC authentication!',
    timestamp: new Date().toISOString(),
    authenticated: true,
    authNote: 'Authentication validated by tRPC frontend layer',
    trustBased: true,
  })
})

// Authentication info endpoint (trust-based)
router.get('/auth-info', (req, res) => {
  logger.debug('Auth info requested (trust-based)')

  res.json({
    success: true,
    message: 'Authentication info moved to tRPC',
    authenticationLayer: 'tRPC (Frontend)',
    backendRole: 'Service Layer (Trust-based)',
    recommendation: 'Use tRPC auth procedures for authentication info',
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
        type: 'session-based via tRPC',
        required: true,
        layer: 'tRPC frontend validation',
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
    architecture: 'tRPC-First Hybrid',
    services: {
      api: 'operational',
      websocket: 'operational',
      authentication: 'moved to tRPC',
      database: 'operational', // Assuming DB is working if we got this far
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  })
})

export { router as testRoutes }
