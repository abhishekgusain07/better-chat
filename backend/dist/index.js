'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.io = exports.server = exports.app = void 0
const express_1 = __importDefault(require('express'))
const http_1 = __importDefault(require('http'))
const cors_1 = __importDefault(require('cors'))
const helmet_1 = __importDefault(require('helmet'))
const compression_1 = __importDefault(require('compression'))
const morgan_1 = __importDefault(require('morgan'))
const socket_io_1 = require('socket.io')
const env_1 = require('@/env')
const middleware_1 = require('@/middleware')
const routes_1 = require('@/routes')
const websocket_1 = require('@/websocket')
const logger_1 = require('@/utils/logger')
const app = (0, express_1.default)()
exports.app = app
const server = http_1.default.createServer(app)
exports.server = server
const io = new socket_io_1.Server(server, {
  cors: {
    origin: env_1.env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/ws/',
})
exports.io = io
app.use(
  (0, helmet_1.default)({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...env_1.env.ALLOWED_ORIGINS],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
  })
)
app.use(
  (0, cors_1.default)({
    origin: env_1.env.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
)
app.use((0, compression_1.default)())
app.use(
  (0, morgan_1.default)(
    env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev'
  )
)
app.use(express_1.default.json({ limit: '50mb' }))
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }))
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env_1.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  })
})
;(0, middleware_1.setupMiddleware)(app)
;(0, routes_1.setupRoutes)(app)
;(0, websocket_1.setupWebSocket)(io)
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  })
})
app.use((err, req, res, next) => {
  logger_1.logger.error('Unhandled error:', err)
  if (res.headersSent) {
    return next(err)
  }
  res.status(500).json({
    error: 'Internal Server Error',
    message:
      env_1.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong',
    timestamp: new Date().toISOString(),
  })
})
const gracefulShutdown = () => {
  logger_1.logger.info('Received shutdown signal, closing server...')
  server.close((err) => {
    if (err) {
      logger_1.logger.error('Error during server shutdown:', err)
      process.exit(1)
    }
    logger_1.logger.info('Server closed successfully')
    process.exit(0)
  })
  setTimeout(() => {
    logger_1.logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 30000)
}
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)
process.on('uncaughtException', (err) => {
  logger_1.logger.error('Uncaught exception:', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason, promise) => {
  logger_1.logger.error('Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})
server.listen(env_1.env.PORT, () => {
  logger_1.logger.info(`🚀 Server running on port ${env_1.env.PORT}`)
  logger_1.logger.info(`📡 WebSocket server ready`)
  logger_1.logger.info(`🌍 Environment: ${env_1.env.NODE_ENV}`)
  logger_1.logger.info(`🔗 Frontend URL: ${env_1.env.FRONTEND_URL}`)
})
//# sourceMappingURL=index.js.map
