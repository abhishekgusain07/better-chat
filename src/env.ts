import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'
import { config } from 'dotenv'
config()

// Polar API
// https://docs.polar.sh/api/overview

export const env = createEnv({
  shared: {
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
  },
  server: {
    DATABASE_URL: z.string(),
    BETTER_AUTH_SECRET: z.string(),
    POLAR_ACCESS_TOKEN: z.string(),
    POLAR_WEBHOOK_SECRET: z.string(),
    POLAR_STARTER_PRODUCT_ID: z.string().optional(),
    POLAR_PRO_PRODUCT_ID: z.string().optional(),
    POLAR_ENTERPRISE_PRODUCT_ID: z.string().optional(),
    POLAR_SUCCESS_URL: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_FRONTEND_BASE_URL: z.string(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    NEXT_PUBLIC_FRONTEND_BASE_URL: process.env.NEXT_PUBLIC_FRONTEND_BASE_URL,
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
    POLAR_STARTER_PRODUCT_ID: process.env.POLAR_STARTER_PRODUCT_ID,
    POLAR_PRO_PRODUCT_ID: process.env.POLAR_PRO_PRODUCT_ID,
    POLAR_ENTERPRISE_PRODUCT_ID: process.env.POLAR_ENTERPRISE_PRODUCT_ID,
    POLAR_SUCCESS_URL: process.env.POLAR_SUCCESS_URL,
  },
  skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
})
