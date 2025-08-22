import { env } from '@/env'

export interface Logger {
  error: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
}

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

const currentLogLevel = logLevels[env.LOG_LEVEL]

const formatMessage = (
  level: string,
  message: string,
  ...args: unknown[]
): string => {
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

const createLogger = (): Logger => ({
  error: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.error) {
      console.error(formatMessage('error', message, ...args))
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.warn) {
      console.warn(formatMessage('warn', message, ...args))
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.info) {
      console.log(formatMessage('info', message, ...args))
    }
  },

  debug: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.debug) {
      console.log(formatMessage('debug', message, ...args))
    }
  },
})

export const logger = createLogger()
