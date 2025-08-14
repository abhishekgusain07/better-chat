import { db } from '@/db'
import { account, session, user, verification } from '@/db/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { checkout, polar, portal, usage, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import { env } from '@/env'

const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: env.NODE_ENV === 'production' ? 'production' : 'sandbox',
})

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      account,
      session,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  // socialProviders: {
  //     github: {
  //        clientId: process.env.GITHUB_CLIENT_ID as string,
  //        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
  //     },
  // },
  trustedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 30 * 60, // 30 minutes - increased from 5 minutes for better performance
    },
  },
  advanced: {
    defaultSignInRedirect: '/dashboard',
    defaultSignUpRedirect: '/dashboard',
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      authenticatedUsersOnly: true,
      use: [
        portal(),
        usage(),
        checkout({
          products: [
            {
              productId: env.POLAR_PRO_PRODUCT_ID || '',
              slug: 'pro',
            },
            {
              productId: env.POLAR_TEAM_PRODUCT_ID || '',
              slug: 'team',
            },
          ],
          successUrl:
            env.POLAR_SUCCESS_URL ||
            `${env.NEXT_PUBLIC_FRONTEND_BASE_URL}/billing?success=true`,
        }),
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET || '',
          onCustomerCreated: async (payload) => {
            const { handleCustomerCreated } = await import(
              '@/lib/polar/customer.created'
            )
            await handleCustomerCreated(payload)
          },
          onSubscriptionCreated: async (payload) => {
            const { handleSubscriptionCreated } = await import(
              '@/lib/polar/subscription.created'
            )
            await handleSubscriptionCreated(payload)
          },
          onSubscriptionUpdated: async (payload) => {
            const { handleSubscriptionUpdated } = await import(
              '@/lib/polar/subscription.updated'
            )
            await handleSubscriptionUpdated(payload)
          },
          onSubscriptionCanceled: async (payload) => {
            const { handleSubscriptionCanceled } = await import(
              '@/lib/polar/subscription.canceled'
            )
            await handleSubscriptionCanceled(payload)
          },
          onSubscriptionRevoked: async (payload) => {
            const { handleSubscriptionRevoked } = await import(
              '@/lib/polar/subscription.revoked'
            )
            await handleSubscriptionRevoked(payload)
          },
        }),
      ],
    }),
  ],
})
