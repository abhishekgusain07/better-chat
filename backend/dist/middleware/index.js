'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.setupMiddleware = void 0
const express_rate_limit_1 = __importDefault(require('express-rate-limit'))
const env_1 = require('@/env')
const logger_1 = require('@/utils/logger')
const createRateLimiter = () =>
  (0, express_rate_limit_1.default)({
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    max: env_1.env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(env_1.env.RATE_LIMIT_WINDOW_MS / 1000),
    },
    handler: (req, res) => {
      logger_1.logger.warn(`Rate limit exceeded for IP: ${req.ip}`)
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(env_1.env.RATE_LIMIT_WINDOW_MS / 1000),
      })
    },
  })
const requestLogger = (req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    const { method, originalUrl } = req
    const { statusCode } = res
    const logLevel = statusCode >= 400 ? 'warn' : 'debug'
    logger_1.logger[logLevel](
      `${method} ${originalUrl} ${statusCode} - ${duration}ms`
    )
  })
  next()
}
const setupMiddleware = (app) => {
  app.use('/api/', createRateLimiter())
  if (env_1.env.NODE_ENV === 'development') {
    app.use(requestLogger)
  }
  logger_1.logger.info('Middleware setup completed')
}
exports.setupMiddleware = setupMiddleware
//# sourceMappingURL=index.js.map
