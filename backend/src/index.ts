import express from 'express'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { Server as SocketIOServer } from 'socket.io'

import { env } from '@/env'
import { setupMiddleware } from '@/middleware'
import { setupRoutes } from '@/routes'
import { setupWebSocket } from '@/websocket'
import { logger } from '@/utils/logger'
import {
  initializeServices,
  cleanupServices,
  getServiceHealth,
  Services,
} from '@/services'

// Create Express app
const app = express()
const server = http.createServer(app)

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/ws/',
})

// Security middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...env.ALLOWED_ORIGINS],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
  })
)

// CORS configuration
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
)

// Compression and logging
app.use(compression())
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Body parsing middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Health check endpoint with service health
app.get('/health', async (req, res) => {
  try {
    const serviceHealth = await getServiceHealth()

    res.json({
      status: serviceHealth.healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: serviceHealth.services,
    })
  } catch (error) {
    logger.error('Health check failed:', error)
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    })
  }
})

// Setup custom middleware
setupMiddleware(app)

// Setup API routes
setupRoutes(app)

// Initialize service layer
let servicesInitialized = false

;(async () => {
  try {
    await initializeServices()

    // Attach Socket.IO server to WebSocket service
    Services.webSocket().attachSocketServer(io)

    servicesInitialized = true
    logger.info('✅ Service layer integration complete')
  } catch (error) {
    logger.error('❌ Failed to initialize service layer:', error)
    process.exit(1)
  }
})()

// Setup WebSocket handlers
setupWebSocket(io)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  })
})

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error('Unhandled error:', err)

    if (res.headersSent) {
      return next(err)
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message:
        env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      timestamp: new Date().toISOString(),
    })
  }
)

// Graceful shutdown with service cleanup
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server...')

  // Close server first
  server.close(async (err) => {
    if (err) {
      logger.error('Error during server shutdown:', err)
    }

    // Cleanup services
    if (servicesInitialized) {
      try {
        await cleanupServices()
        logger.info('✅ Services cleaned up')
      } catch (error) {
        logger.error('❌ Error during service cleanup:', error)
      }
    }

    logger.info('Server closed successfully')
    process.exit(err ? 1 : 0)
  })

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 30000)
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start server
server.listen(env.PORT, () => {
  logger.info(`🚀 Server running on port ${env.PORT}`)
  logger.info(`📡 WebSocket server ready`)
  logger.info(`🌍 Environment: ${env.NODE_ENV}`)
  logger.info(`🔗 Frontend URL: ${env.FRONTEND_URL}`)
  logger.info(`🏗️  Architecture: tRPC-First Hybrid with Service Layer`)
})

// Export for testing
export { app, server, io }
