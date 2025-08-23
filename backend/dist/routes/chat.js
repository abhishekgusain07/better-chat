'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.chatRoutes = void 0
const express_1 = __importDefault(require('express'))
const logger_1 = require('@/utils/logger')
const simplified_functions_1 = require('@/services/chat/simplified-functions')
const router = express_1.default.Router()
exports.chatRoutes = router
router.use((req, res, next) => {
  logger_1.logger.warn(
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
router.post('/validate-message', async (req, res) => {
  try {
    const { content, images, files } = req.body
    const validation =
      simplified_functions_1.simplifiedChatFunctions.validateMessage(content, {
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
    logger_1.logger.error('Service validation error:', error)
    res.status(500).json({
      success: false,
      error: 'Service validation failed',
      useInstead: 'tRPC chat router',
    })
  }
})
router.post('/estimate-tokens', async (req, res) => {
  try {
    const { content } = req.body
    if (!content) {
      return res.status(400).json({ error: 'Content required' })
    }
    const tokenCount =
      simplified_functions_1.simplifiedChatFunctions.estimateTokens(content)
    res.json({
      success: true,
      tokenCount,
      serviceLayer: 'active',
      note: 'Token estimation via backend service layer',
    })
  } catch (error) {
    logger_1.logger.error('Token estimation error:', error)
    res.status(500).json({
      success: false,
      error: 'Token estimation failed',
    })
  }
})
router.post('/broadcast-test', async (req, res) => {
  try {
    const { conversationId, event, data } = req.body
    const result = {
      success: true,
      clientCount: 0,
    }
    res.json({
      success: result.success,
      clientCount: result.clientCount,
      serviceLayer: 'active',
      note: 'WebSocket broadcasting via service layer (demo)',
      actualBroadcast: false,
    })
  } catch (error) {
    logger_1.logger.error('Broadcast test error:', error)
    res.status(500).json({
      success: false,
      error: 'Broadcast test failed',
    })
  }
})
//# sourceMappingURL=chat.js.map
