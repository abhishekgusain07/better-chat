import express from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '@/env'
import { logger } from '@/utils/logger'

// Rate limiting middleware
const createRateLimiter = () =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
    },
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`)
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
      })
    },
  })

// Request logging middleware
const requestLogger = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const { method, originalUrl } = req
    const { statusCode } = res

    const logLevel = statusCode >= 400 ? 'warn' : 'debug'
    logger[logLevel](`${method} ${originalUrl} ${statusCode} - ${duration}ms`)
  })

  next()
}

// Setup middleware
export const setupMiddleware = (app: express.Application): void => {
  // Rate limiting
  app.use('/api/', createRateLimiter())

  // Request logging
  if (env.NODE_ENV === 'development') {
    app.use(requestLogger)
  }

  logger.info('Middleware setup completed')
}
