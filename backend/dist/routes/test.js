'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.testRoutes = void 0
const express_1 = __importDefault(require('express'))
const logger_1 = require('@/utils/logger')
const router = express_1.default.Router()
exports.testRoutes = router
router.get('/public', (req, res) => {
  logger_1.logger.debug('Public test endpoint accessed')
  res.json({
    success: true,
    message: 'Public test endpoint is working!',
    timestamp: new Date().toISOString(),
    authenticated: false,
    architecture: 'tRPC-First Hybrid',
  })
})
router.get('/protected', (req, res) => {
  logger_1.logger.debug('Protected test endpoint accessed (trust-based)')
  res.json({
    success: true,
    message: 'Protected endpoint working with tRPC authentication!',
    timestamp: new Date().toISOString(),
    authenticated: true,
    authNote: 'Authentication validated by tRPC frontend layer',
    trustBased: true,
  })
})
router.get('/auth-info', (req, res) => {
  logger_1.logger.debug('Auth info requested (trust-based)')
  res.json({
    success: true,
    message: 'Authentication info moved to tRPC',
    authenticationLayer: 'tRPC (Frontend)',
    backendRole: 'Service Layer (Trust-based)',
    recommendation: 'Use tRPC auth procedures for authentication info',
    timestamp: new Date().toISOString(),
  })
})
router.get('/websocket-info', (req, res) => {
  logger_1.logger.debug('WebSocket connection info requested')
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
router.get('/health', (req, res) => {
  logger_1.logger.debug('Test health check accessed')
  res.json({
    success: true,
    status: 'healthy',
    architecture: 'tRPC-First Hybrid',
    services: {
      api: 'operational',
      websocket: 'operational',
      authentication: 'moved to tRPC',
      database: 'operational',
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  })
})
//# sourceMappingURL=test.js.map
