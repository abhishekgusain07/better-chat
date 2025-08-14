import { createAuthClient } from 'better-auth/react'
import { polarClient } from '@polar-sh/better-auth'

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  plugins: [polarClient()],
})

export const { useSession, signIn, signOut, signUp, checkout } = authClient
