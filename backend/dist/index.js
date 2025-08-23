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
const services_1 = require('@/services')
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
app.get('/health', async (req, res) => {
  try {
    const serviceHealth = await (0, services_1.getServiceHealth)()
    res.json({
      status: serviceHealth.healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: env_1.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: serviceHealth.services,
    })
  } catch (error) {
    logger_1.logger.error('Health check failed:', error)
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    })
  }
})
;(0, middleware_1.setupMiddleware)(app)
;(0, routes_1.setupRoutes)(app)
let servicesInitialized = false
;(async () => {
  try {
    await (0, services_1.initializeServices)()
    services_1.Services.webSocket().attachSocketServer(io)
    servicesInitialized = true
    logger_1.logger.info('✅ Service layer integration complete')
  } catch (error) {
    logger_1.logger.error('❌ Failed to initialize service layer:', error)
    process.exit(1)
  }
})()
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
const gracefulShutdown = async () => {
  logger_1.logger.info('Received shutdown signal, closing server...')
  server.close(async (err) => {
    if (err) {
      logger_1.logger.error('Error during server shutdown:', err)
    }
    if (servicesInitialized) {
      try {
        await (0, services_1.cleanupServices)()
        logger_1.logger.info('✅ Services cleaned up')
      } catch (error) {
        logger_1.logger.error('❌ Error during service cleanup:', error)
      }
    }
    logger_1.logger.info('Server closed successfully')
    process.exit(err ? 1 : 0)
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
  logger_1.logger.info(`🏗️  Architecture: tRPC-First Hybrid with Service Layer`)
})
//# sourceMappingURL=index.js.map
