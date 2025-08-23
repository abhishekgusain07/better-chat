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
//# sourceMappingURL=chat.js.map
