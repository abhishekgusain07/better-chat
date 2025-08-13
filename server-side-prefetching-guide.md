# Server-Side Prefetching with tRPC and React Query

A comprehensive guide to eliminate hydration flicker by prefetching data server-side and seamlessly hydrating it on the client.

## Table of Contents
- [Overview](#overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Step-by-Step Implementation](#step-by-step-implementation)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Server-side prefetching eliminates the common "flicker" problem where:
1. Server renders initial state (e.g., "Sign In" button)
2. Client loads and fetches data
3. UI updates with new state (e.g., "Dashboard" button)

This creates a jarring user experience. Our solution pre-fetches data server-side and hydrates it seamlessly on the client.

## The Problem

### Common Hydration Flicker Scenario

```tsx
// ❌ Problematic approach - causes flicker
export default function HomePage() {
  const { data: session } = useSession() // Client-side fetch
  
  return (
    <div>
      {session?.user ? (
        <Link href="/dashboard">Dashboard</Link> // Shows after hydration
      ) : (
        <Link href="/sign-in">Sign In</Link>    // Shows initially
      )}
    </div>
  )
}
```

**What happens:**
1. Server renders "Sign In" button (no session data)
2. Page loads, React Query fetches session
3. UI flickers to "Dashboard" button

## The Solution

### Architecture Overview

```
1. Server Component (layout.tsx)
   ↓ Fetches data server-side
   
2. Provider Components (TRPCProvider → SessionProvider)
   ↓ Hydrates React Query cache
   
3. Client Components (page.tsx)
   ↓ Uses pre-hydrated data via context
```

## Step-by-Step Implementation

### Step 1: Create Server-Side Data Fetchers

Create utilities to fetch data on the server using your existing auth/database setup.

```typescript
// src/lib/server-auth.ts
import { auth } from './auth'
import { headers } from 'next/headers'
import 'server-only' // Ensures this only runs on server

export async function getServerSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })
    return session
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}

export async function getServerUser() {
  const session = await getServerSession()
  return session?.user || null
}
```

**Key Points:**
- Use `'server-only'` import to prevent client-side execution
- Handle errors gracefully with try/catch
- Return null for consistent fallback behavior

### Step 2: Create a Context Provider for Hydrated Data

This provider bridges server-fetched data with client-side state management.

```typescript
// src/components/session-provider.tsx
'use client'

import { useSession } from '@/lib/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, type ReactNode } from 'react'

interface SessionProviderProps {
  children: ReactNode
  initialSession?: {
    user?: {
      id: string
      email: string
      name?: string
    }
  } | null
}

const SessionContext = createContext<{
  session: {
    user?: {
      id: string
      email: string
      name?: string
    }
  } | null
  isLoading: boolean
}>({
  session: null,
  isLoading: true,
})

export function SessionProvider({ children, initialSession }: SessionProviderProps) {
  const queryClient = useQueryClient()
  const { data: session, isLoading } = useSession()

  useEffect(() => {
    if (initialSession && !session && !isLoading) {
      // Pre-populate React Query cache with server data
      queryClient.setQueryData(['session'], initialSession)
    }
  }, [initialSession, session, isLoading, queryClient])

  return (
    <SessionContext.Provider 
      value={{ 
        session: session || initialSession, 
        isLoading: isLoading && !initialSession 
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSessionContext() {
  return useContext(SessionContext)
}
```

**Key Points:**
- Accepts `initialSession` prop from server
- Uses React Query's `setQueryData` to hydrate cache
- Provides immediate access to session state
- Handles loading states intelligently

### Step 3: Update Your tRPC Provider

Modify your existing tRPC provider to accept and hydrate initial data.

```typescript
// src/trpc/provider.tsx
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
      // Pre-populate specific query keys
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
```

**Key Points:**
- Accept `initialSession` prop
- Hydrate React Query cache before rendering children
- Wrap with custom SessionProvider

### Step 4: Fetch Data in Server Components

Modify your layout or page to fetch data server-side.

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { TRPCProvider } from '@/trpc/provider'
import { getServerSession } from '@/lib/server-auth'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch session data server-side
  const initialSession = await getServerSession()
  
  return (
    <html lang="en">
      <body>
        <TRPCProvider initialSession={initialSession}>
          {children}
        </TRPCProvider>
      </body>
    </html>
  )
}
```

**Key Points:**
- Make component `async` to use server-side data fetching
- Pass fetched data as props to providers
- This runs on every request, providing fresh data

### Step 5: Consume Hydrated Data in Client Components

Update your client components to use the hydrated context instead of direct hooks.

```typescript
// src/app/page.tsx
'use client'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth-client'
import { useSessionContext } from '@/components/session-provider'
import Link from 'next/link'

export default function Home() {
  // ✅ Use context instead of direct hook
  const { session } = useSessionContext()
  
  return (
    <div>
      {session?.user ? (
        <div>
          <Link href="/dashboard">
            <Button>Dashboard</Button>
          </Link>
          <Button onClick={() => signOut()}>Logout</Button>
        </div>
      ) : (
        <div>
          <Link href="/sign-up">
            <Button>Sign Up</Button>
          </Link>
          <Link href="/sign-in">
            <Button>Sign In</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
```

**Key Points:**
- Use `useSessionContext()` instead of `useSession()`
- Session data is immediately available
- No loading states needed for initial render

## Advanced Patterns

### Pattern 1: Prefetching Multiple Queries

```typescript
// Server-side fetcher for multiple data types
export async function getServerData() {
  const [session, userProfile, notifications] = await Promise.all([
    getServerSession(),
    getUserProfile(),
    getNotifications(),
  ])
  
  return {
    session,
    userProfile,
    notifications,
  }
}

// In your provider
useEffect(() => {
  if (initialData) {
    queryClient.setQueryData(['session'], initialData.session)
    queryClient.setQueryData(['user-profile'], initialData.userProfile)
    queryClient.setQueryData(['notifications'], initialData.notifications)
  }
}, [initialData, queryClient])
```

### Pattern 2: Conditional Prefetching

```typescript
// Only prefetch data for authenticated users
export default async function Layout({ children }: LayoutProps) {
  const session = await getServerSession()
  
  // Only fetch additional data if user is authenticated
  const initialData = session?.user 
    ? await getUserDashboardData(session.user.id)
    : null
  
  return (
    <TRPCProvider 
      initialSession={session}
      initialData={initialData}
    >
      {children}
    </TRPCProvider>
  )
}
```

### Pattern 3: Page-Specific Prefetching

```typescript
// src/app/dashboard/page.tsx
import { getDashboardData } from '@/lib/server-data'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const dashboardData = await getDashboardData()
  
  return <DashboardClient initialData={dashboardData} />
}

// dashboard-client.tsx
'use client'
export default function DashboardClient({ initialData }: Props) {
  const { data } = trpc.dashboard.getData.useQuery(undefined, {
    initialData, // Use server-fetched data as initial value
  })
  
  return <div>{/* Render with no loading state */}</div>
}
```

## Best Practices

### 1. Type Safety

Always define proper TypeScript interfaces for your data:

```typescript
interface ServerSession {
  user?: {
    id: string
    email: string
    name?: string
    role: 'user' | 'admin'
  }
  expiresAt: string
}
```

### 2. Error Boundaries

Wrap your providers with error boundaries:

```typescript
export function TRPCProvider({ children, initialSession }: Props) {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider initialSession={initialSession}>
            {children}
          </SessionProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  )
}
```

### 3. Stale Data Handling

Configure React Query to handle stale data appropriately:

```typescript
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
}))
```

### 4. Development vs Production

Add development-only logging:

```typescript
useEffect(() => {
  if (initialSession) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Hydrating session:', initialSession)
    }
    queryClient.setQueryData(['session'], initialSession)
  }
}, [initialSession, queryClient])
```

### 5. Performance Optimization

For large applications, consider selective hydration:

```typescript
// Only hydrate critical data immediately
const criticalKeys = ['session', 'user-preferences']

useEffect(() => {
  if (initialData) {
    Object.entries(initialData).forEach(([key, value]) => {
      if (criticalKeys.includes(key) && value !== null) {
        queryClient.setQueryData([key], value)
      }
    })
  }
}, [initialData, queryClient])
```

## Troubleshooting

### Issue: Data Not Hydrating

**Problem:** Server data isn't appearing on client.

**Solutions:**
1. Check that query keys match exactly between server and client
2. Verify data is being passed through all provider layers
3. Ensure `useEffect` dependencies are correct

```typescript
// ❌ Mismatched keys
queryClient.setQueryData(['user'], serverData)        // Server
const { data } = trpc.getUser.useQuery()              // Client uses different key

// ✅ Matched keys
queryClient.setQueryData(['trpc', 'getUser'], serverData)  // Server
const { data } = trpc.getUser.useQuery()                   // Client
```

### Issue: Hydration Mismatch Warnings

**Problem:** React warns about server/client content mismatch.

**Solutions:**
1. Ensure server and client render the same initial state
2. Use `suppressHydrationWarning` sparingly for dynamic content
3. Consider using `useEffect` for client-only content

```typescript
// ✅ Consistent rendering
const { session, isLoading } = useSessionContext()

if (isLoading) {
  return <LoadingSkeleton /> // Same on server and client
}

return session?.user ? <Dashboard /> : <LoginForm />
```

### Issue: Poor Performance

**Problem:** Too much data being prefetched.

**Solutions:**
1. Only prefetch critical, above-the-fold data
2. Use lazy loading for non-critical data
3. Implement selective hydration based on route

```typescript
// ✅ Selective prefetching
const shouldPrefetch = pathname.startsWith('/dashboard')
const initialData = shouldPrefetch ? await getDashboardData() : null
```

### Issue: Stale Data

**Problem:** Server-fetched data becomes stale quickly.

**Solutions:**
1. Configure appropriate `staleTime` in React Query
2. Implement background refetching
3. Use optimistic updates for mutations

```typescript
const { data } = trpc.getUser.useQuery(undefined, {
  initialData: serverUser,
  staleTime: 30 * 1000, // Consider fresh for 30 seconds
  refetchOnMount: 'always', // Always refetch when component mounts
})
```

## Conclusion

Server-side prefetching with tRPC and React Query provides:

- ✅ Zero hydration flicker
- ✅ Better performance and UX
- ✅ SEO-friendly content
- ✅ Type-safe data flow
- ✅ Consistent state management

This pattern is particularly valuable for:
- Authentication state
- User preferences
- Critical dashboard data
- Above-the-fold content

The key is to prefetch only what's necessary for the initial render and let React Query handle subsequent data fetching and caching.