import { Suspense } from 'react'
import { BillingPageClient } from './billing-client'
import { getServerSession } from '@/lib/server-auth'
import { redirect } from 'next/navigation'
import { HydrateClient, trpc } from '@/trpc/server'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Get session using proper server auth
  const session = await getServerSession()

  if (!session?.user) {
    redirect('/sign-in')
  }

  // Get search params
  const params = await searchParams
  const showSuccess = params?.success === 'true'

  // Prefetch billing data using TRPC
  void trpc.billing.getCurrentSubscription.prefetch()

  return (
    <HydrateClient>
      <Suspense fallback={<BillingPageSkeleton />}>
        <BillingPageClient user={session.user} showSuccess={showSuccess} />
      </Suspense>
    </HydrateClient>
  )
}

function BillingPageSkeleton() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>
        <div className="space-y-6">
          {/* Current Plan Skeleton */}
          <div className="bg-white border rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>

          {/* Usage Skeleton */}
          <div className="bg-white border rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Features Skeleton */}
          <div className="bg-white border rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-6 bg-gray-200 rounded w-3/4"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
