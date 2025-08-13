'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { useEffect, useState } from 'react'
import superjson from 'superjson'
import type { AppRouter } from './routers/_app'
import { SessionProvider } from '@/components/session-provider'

export const trpc = createTRPCReact<AppRouter>()

interface TRPCProviderProps {
  children: React.ReactNode
  initialSession?: {
    user?: {
      id: string
      email: string
      name?: string
    }
  } | null
}

export function TRPCProvider({ children, initialSession }: TRPCProviderProps) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    })
  )

  useEffect(() => {
    if (initialSession) {
      queryClient.setQueryData(['session'], initialSession)
    }
  }, [initialSession, queryClient])

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider initialSession={initialSession}>
          {children}
        </SessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
