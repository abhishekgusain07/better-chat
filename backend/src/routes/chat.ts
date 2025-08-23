import express from 'express'
import { logger } from '@/utils/logger'

const router = express.Router()

// Note: Authentication removed - all auth now handled by tRPC in frontend
// These routes are trust-based and will be converted to service functions
// TODO: Convert to service functions in Phase 2

// Temporary deprecation middleware - all chat operations should use tRPC
router.use((req, res, next) => {
  logger.warn(
    `Deprecated backend chat route accessed: ${req.method} ${req.path}`
  )
  res.status(410).json({
    error: 'Route Deprecated',
    message: 'Chat operations have been moved to tRPC in the frontend',
    deprecated: true,
    migration: 'Use tRPC chat router instead of backend REST endpoints',
    trpcRoute: req.path.replace('/api/v1/chat', 'trpc.chat'),
    timestamp: new Date().toISOString(),
  })
})

// Route handlers removed - all operations deprecated in favor of tRPC
// Original validation schemas were moved to tRPC layer

// All route handlers removed - operations moved to tRPC frontend layer
// Deprecation middleware above handles all requests with HTTP 410

export { router as chatRoutes }
