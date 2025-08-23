'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.authRoutes = void 0
const express_1 = __importDefault(require('express'))
const logger_1 = require('@/utils/logger')
const router = express_1.default.Router()
exports.authRoutes = router
router.post('/signout', async (req, res) => {
  logger_1.logger.warn(
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
router.get('/me', (req, res) => {
  res.json({
    success: true,
    message: 'User info endpoint moved to tRPC - use frontend authentication',
    deprecated: true,
    redirectTo: 'Use tRPC auth.me procedure instead',
  })
})
//# sourceMappingURL=auth.js.map
