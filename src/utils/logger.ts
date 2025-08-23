// Logger utility for frontend tRPC operations
interface LoggerLevel {
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

const createLogger = (): LoggerLevel => {
  const isDevelopment = process.env.NODE_ENV === 'development'

  return {
    debug: (...args: any[]) => {
      if (isDevelopment) {
        console.debug('[tRPC-DEBUG]', ...args)
      }
    },
    info: (...args: any[]) => {
      if (isDevelopment) {
        console.info('[tRPC-INFO]', ...args)
      }
    },
    warn: (...args: any[]) => {
      console.warn('[tRPC-WARN]', ...args)
    },
    error: (...args: any[]) => {
      console.error('[tRPC-ERROR]', ...args)
    },
  }
}

export const logger = createLogger()
