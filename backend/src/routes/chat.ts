import express from 'express'
import { logger } from '@/utils/logger'
import { simplifiedChatFunctions } from '@/services/chat/simplified-functions'

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

// Service function examples - demonstrate how to use service layer from routes
// These routes are deprecated but show integration patterns for future service endpoints

// Example: Service-powered message validation endpoint
router.post('/validate-message', async (req, res): Promise<any> => {
  try {
    const { content, images, files } = req.body

    const validation = simplifiedChatFunctions.validateMessage(content, {
      images: images || [],
      files: files || [],
    })

    res.json({
      success: true,
      validation,
      serviceLayer: 'active',
      note: 'Use tRPC chat.sendMessage for actual message operations',
    })
  } catch (error) {
    logger.error('Service validation error:', error)
    res.status(500).json({
      success: false,
      error: 'Service validation failed',
      useInstead: 'tRPC chat router',
    })
  }
})

// Example: Token estimation endpoint using service layer
router.post('/estimate-tokens', async (req, res): Promise<any> => {
  try {
    const { content } = req.body

    if (!content) {
      return res.status(400).json({ error: 'Content required' })
    }

    const tokenCount = simplifiedChatFunctions.estimateTokens(content)

    res.json({
      success: true,
      tokenCount,
      serviceLayer: 'active',
      note: 'Token estimation via backend service layer',
    })
  } catch (error) {
    logger.error('Token estimation error:', error)
    res.status(500).json({
      success: false,
      error: 'Token estimation failed',
    })
  }
})

// Example: WebSocket broadcast endpoint (for testing service integration)
router.post('/broadcast-test', async (req, res): Promise<any> => {
  try {
    const { conversationId, event, data } = req.body

    // Simulate broadcast result
    const result = {
      success: true,
      clientCount: 0, // Would get actual count from WebSocket service
    }

    res.json({
      success: result.success,
      clientCount: result.clientCount,
      serviceLayer: 'active',
      note: 'WebSocket broadcasting via service layer (demo)',
      actualBroadcast: false,
    })
  } catch (error) {
    logger.error('Broadcast test error:', error)
    res.status(500).json({
      success: false,
      error: 'Broadcast test failed',
    })
  }
})

// All other route handlers removed - operations moved to tRPC frontend layer
// Deprecation middleware above handles remaining requests with HTTP 410

export { router as chatRoutes }
