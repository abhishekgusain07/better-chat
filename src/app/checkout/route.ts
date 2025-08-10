import { env } from '@/env'
import { Checkout } from '@polar-sh/nextjs'

export const GET = Checkout({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: 'production', // Use sandbox for testing purposes - otherwise use 'production' or omit this line
  successUrl: `${env.NEXT_PUBLIC_FRONTEND_BASE_URL}/confirmation`,
})
