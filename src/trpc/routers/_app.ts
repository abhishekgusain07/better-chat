import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'
import { billingRouter } from './billing'
import { chatRouter } from './chat'
import { llmRouter } from './llm'
import { providersRouter } from './providers'
import { usageRouter } from './usage'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  billing: billingRouter,
  chat: chatRouter,
  llm: llmRouter,
  providers: providersRouter,
  usage: usageRouter,
})

export type AppRouter = typeof appRouter
