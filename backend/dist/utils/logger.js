'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.logger = void 0
const env_1 = require('@/env')
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}
const currentLogLevel = logLevels[env_1.env.LOG_LEVEL]
const formatMessage = (level, message, ...args) => {
  const timestamp = new Date().toISOString()
  const formattedArgs =
    args.length > 0
      ? ' ' +
        args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          )
          .join(' ')
      : ''
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`
}
const createLogger = () => ({
  error: (message, ...args) => {
    if (currentLogLevel >= logLevels.error) {
      console.error(formatMessage('error', message, ...args))
    }
  },
  warn: (message, ...args) => {
    if (currentLogLevel >= logLevels.warn) {
      console.warn(formatMessage('warn', message, ...args))
    }
  },
  info: (message, ...args) => {
    if (currentLogLevel >= logLevels.info) {
      console.log(formatMessage('info', message, ...args))
    }
  },
  debug: (message, ...args) => {
    if (currentLogLevel >= logLevels.debug) {
      console.log(formatMessage('debug', message, ...args))
    }
  },
})
exports.logger = createLogger()
//# sourceMappingURL=logger.js.map
