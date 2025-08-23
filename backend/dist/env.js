'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.env = void 0
const zod_1 = require('zod')
const dotenv_1 = require('dotenv')
;(0, dotenv_1.config)()
const envSchema = zod_1.z.object({
  NODE_ENV: zod_1.z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: zod_1.z.string().default('3001').transform(Number),
  DATABASE_URL: zod_1.z.string().min(1),
  BETTER_AUTH_SECRET: zod_1.z.string().min(32),
  BETTER_AUTH_URL: zod_1.z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: zod_1.z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGINS: zod_1.z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  WEBSOCKET_PORT: zod_1.z.string().default('3002').transform(Number),
  ANTHROPIC_API_KEY: zod_1.z.string().optional(),
  OPENAI_API_KEY: zod_1.z.string().optional(),
  GOOGLE_API_KEY: zod_1.z.string().optional(),
  POLAR_ACCESS_TOKEN: zod_1.z.string().optional(),
  POLAR_WEBHOOK_SECRET: zod_1.z.string().optional(),
  POLAR_STARTER_PRODUCT_ID: zod_1.z.string().optional(),
  POLAR_PRO_PRODUCT_ID: zod_1.z.string().optional(),
  POLAR_ENTERPRISE_PRODUCT_ID: zod_1.z.string().optional(),
  POLAR_SUCCESS_URL: zod_1.z.string().optional(),
  UPLOAD_DIR: zod_1.z.string().default('./uploads'),
  MAX_FILE_SIZE: zod_1.z.string().default('10485760').transform(Number),
  RATE_LIMIT_WINDOW_MS: zod_1.z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: zod_1.z.string().default('100').transform(Number),
  LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
})
const parseResult = envSchema.safeParse(process.env)
if (!parseResult.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parseResult.error.format())
  process.exit(1)
}
exports.env = parseResult.data
//# sourceMappingURL=env.js.map
