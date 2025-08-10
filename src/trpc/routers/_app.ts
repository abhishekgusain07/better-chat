import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
})

export type AppRouter = typeof appRouter
