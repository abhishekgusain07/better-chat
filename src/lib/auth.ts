import { db } from '@/db'
import { account, session, user, verification } from '@/db/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { checkout, polar, portal, usage, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import { env } from '@/env'
import { handleCustomerCreated } from '@/lib/polar/customer.created'
import { handleSubscriptionCreated } from '@/lib/polar/subscription.created'
import { handleSubscriptionUpdated } from '@/lib/polar/subscription.updated'
import { handleSubscriptionCanceled } from '@/lib/polar/subscription.canceled'
import { handleSubscriptionRevoked } from '@/lib/polar/subscription.revoked'

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
              productId: env.POLAR_HOBBY_PRODUCT_ID || '',
              slug: 'hobby',
            },
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
            await handleCustomerCreated(payload)
          },
          onSubscriptionCreated: async (payload) => {
            await handleSubscriptionCreated(payload)
          },
          onSubscriptionUpdated: async (payload) => {
            await handleSubscriptionUpdated(payload)
          },
          onSubscriptionCanceled: async (payload) => {
            await handleSubscriptionCanceled(payload)
          },
          onSubscriptionRevoked: async (payload) => {
            await handleSubscriptionRevoked(payload)
          },
        }),
      ],
    }),
  ],
})
