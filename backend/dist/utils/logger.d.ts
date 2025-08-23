export interface Logger {
  error: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
}
export declare const logger: Logger
//# sourceMappingURL=logger.d.ts.map
