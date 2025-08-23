import { z } from 'zod'
import { config } from 'dotenv'

// Load environment variables
config()

const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3001').transform(Number),

  // Database
  DATABASE_URL: z.string().min(1),

  // Authentication
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),

  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),

  // WebSocket
  WEBSOCKET_PORT: z.string().default('3002').transform(Number),

  // LLM Providers
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Polar Billing
  POLAR_ACCESS_TOKEN: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),
  POLAR_STARTER_PRODUCT_ID: z.string().optional(),
  POLAR_PRO_PRODUCT_ID: z.string().optional(),
  POLAR_ENTERPRISE_PRODUCT_ID: z.string().optional(),
  POLAR_SUCCESS_URL: z.string().optional(),

  // File Storage
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().default('10485760').transform(Number), // 10MB

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
})

// Validate environment variables
const parseResult = envSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parseResult.error.format())
  process.exit(1)
}

export const env = parseResult.data

// Type-only export for other files
export type Env = typeof env
