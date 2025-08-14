import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'
import { billingRouter } from './billing'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  billing: billingRouter,
})

export type AppRouter = typeof appRouter
