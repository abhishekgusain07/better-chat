export declare const env: {
  NODE_ENV: 'development' | 'production' | 'test'
  PORT: number
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  FRONTEND_URL: string
  ALLOWED_ORIGINS: string[]
  WEBSOCKET_PORT: number
  UPLOAD_DIR: string
  MAX_FILE_SIZE: number
  RATE_LIMIT_WINDOW_MS: number
  RATE_LIMIT_MAX_REQUESTS: number
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug'
  ANTHROPIC_API_KEY?: string | undefined
  OPENAI_API_KEY?: string | undefined
  GOOGLE_API_KEY?: string | undefined
  POLAR_ACCESS_TOKEN?: string | undefined
  POLAR_WEBHOOK_SECRET?: string | undefined
  POLAR_STARTER_PRODUCT_ID?: string | undefined
  POLAR_PRO_PRODUCT_ID?: string | undefined
  POLAR_ENTERPRISE_PRODUCT_ID?: string | undefined
  POLAR_SUCCESS_URL?: string | undefined
}
export type Env = typeof env
//# sourceMappingURL=env.d.ts.map
