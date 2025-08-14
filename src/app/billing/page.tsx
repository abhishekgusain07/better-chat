'use client'

import { Button } from '@/components/ui/button'
import { UpgradeModal } from '@/components/billing/upgrade-modal'
import { useSession } from '@/lib/auth-client'
import { useState, useEffect } from 'react'
import { getUserPlan, PRICING_PLANS, getPlanLimits } from '@/lib/plans'
import { useSearchParams } from 'next/navigation'
import { Subscription } from '@/types/subscription'

export default function BillingPage() {
  const { data: session } = useSession()
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const searchParams = useSearchParams()

  // Fetch user's subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!session?.user) return

      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/subscription')

        if (!response.ok) {
          throw new Error('Failed to fetch subscription')
        }

        const data = await response.json()
        setSubscription(data.subscription)
      } catch (err) {
        console.error('Error fetching subscription:', err)
        setError('Failed to load subscription data')
      } finally {
        setLoading(false)
      }
    }

    fetchSubscription()
  }, [session])

  // Check for success parameter
  useEffect(() => {
    if (searchParams?.get('success') === 'true') {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      // Refetch subscription after successful payment
      if (session?.user) {
        setTimeout(async () => {
          try {
            const response = await fetch('/api/subscription')
            if (response.ok) {
              const data = await response.json()
              setSubscription(data.subscription)
            }
          } catch (err) {
            console.error('Error refetching subscription:', err)
          }
        }, 2000) // Wait 2 seconds for webhook to process
      }
    }
  }, [searchParams, session])

  const currentPlan = getUserPlan(subscription)
  const planLimits = getPlanLimits(currentPlan)
  const currentPricingPlan = PRICING_PLANS.find(
    (p) => p.title.toLowerCase() === currentPlan
  )

  if (!session?.user) {
    return (
      <div className="container mx-auto py-8">
        <p>Please sign in to view your billing information.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>
          <div className="bg-white border rounded-lg p-6 mb-8">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">Error: {error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {showSuccess && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          Payment successful! Your subscription has been updated.
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>

        {/* Current Plan */}
        <div className="bg-white border rounded-lg p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">Current Plan</h2>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold capitalize">
                  {currentPlan}
                </span>
                {currentPricingPlan && (
                  <span className="text-gray-600">
                    {currentPricingPlan.price.monthly}/month
                  </span>
                )}
              </div>
              {currentPricingPlan && (
                <p className="text-gray-600 mt-1">
                  {currentPricingPlan.description}
                </p>
              )}
            </div>
            {currentPlan === 'free' && (
              <Button onClick={() => setUpgradeModalOpen(true)}>
                Upgrade Plan
              </Button>
            )}
          </div>

          {subscription && (
            <div className="text-sm text-gray-600">
              <p>
                Status:{' '}
                <span className="capitalize font-medium">
                  {subscription.status}
                </span>
              </p>
              <p>
                Next billing:{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
              {subscription.cancelAtPeriodEnd && (
                <p className="text-orange-600 font-medium">
                  Subscription will cancel at end of billing period
                </p>
              )}
            </div>
          )}
        </div>

        {/* Usage & Limits */}
        <div className="bg-white border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Usage & Limits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium mb-2">Users</h3>
              <div className="text-2xl font-bold">
                1{' '}
                <span className="text-gray-400">
                  / {planLimits.maxUsers === -1 ? '∞' : planLimits.maxUsers}
                </span>
              </div>
              <div className="text-sm text-gray-600">Current users</div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Projects</h3>
              <div className="text-2xl font-bold">
                0{' '}
                <span className="text-gray-400">
                  /{' '}
                  {planLimits.maxProjects === -1 ? '∞' : planLimits.maxProjects}
                </span>
              </div>
              <div className="text-sm text-gray-600">Active projects</div>
            </div>
            <div>
              <h3 className="font-medium mb-2">API Calls</h3>
              <div className="text-2xl font-bold">
                0{' '}
                <span className="text-gray-400">
                  /{' '}
                  {planLimits.maxApiCalls === -1
                    ? '∞'
                    : planLimits.maxApiCalls.toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-gray-600">This month</div>
            </div>
          </div>
        </div>

        {/* Plan Features */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Plan Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`flex items-center gap-2 ${planLimits.features.prioritySupport ? 'text-green-600' : 'text-gray-400'}`}
            >
              <span className="text-sm">
                {planLimits.features.prioritySupport ? '✓' : '✗'}
              </span>
              <span>Priority Support</span>
            </div>
            <div
              className={`flex items-center gap-2 ${planLimits.features.advancedAnalytics ? 'text-green-600' : 'text-gray-400'}`}
            >
              <span className="text-sm">
                {planLimits.features.advancedAnalytics ? '✓' : '✗'}
              </span>
              <span>Advanced Analytics</span>
            </div>
            <div
              className={`flex items-center gap-2 ${planLimits.features.teamCollaboration ? 'text-green-600' : 'text-gray-400'}`}
            >
              <span className="text-sm">
                {planLimits.features.teamCollaboration ? '✓' : '✗'}
              </span>
              <span>Team Collaboration</span>
            </div>
            <div
              className={`flex items-center gap-2 ${planLimits.features.customIntegrations ? 'text-green-600' : 'text-gray-400'}`}
            >
              <span className="text-sm">
                {planLimits.features.customIntegrations ? '✓' : '✗'}
              </span>
              <span>Custom Integrations</span>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentPlan={currentPlan}
        userId={session?.user?.id}
      />
    </div>
  )
}
