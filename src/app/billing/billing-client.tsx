'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { UpgradeModal } from '@/components/billing/upgrade-modal'
import {
  CheckCircle,
  XCircle,
  Calendar,
  CreditCard,
  Users,
  FolderOpen,
  Zap,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/trpc/react'

interface BillingPageClientProps {
  user: { id: string; email: string; name: string }
  showSuccess: boolean
}

function getStatusColor(status: string | undefined) {
  if (!status) return 'bg-gray-100 text-gray-800 border-gray-200'

  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'trialing':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'past_due':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'cancelled':
    case 'expired':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getPlanColor(plan: string | undefined | null) {
  if (!plan) return 'bg-orange-100 text-orange-800 border-orange-200'

  switch (plan) {
    case 'hobby':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'pro':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'team':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export function BillingPageClient({
  user,
  showSuccess,
}: BillingPageClientProps) {
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [successVisible, setSuccessVisible] = useState(showSuccess)

  // TRPC queries and mutations
  const {
    data: billingData,
    isLoading,
    error,
    refetch,
  } = trpc.billing.getCurrentSubscription.useQuery(undefined, {
    retry: 3,
    retryDelay: 1000,
    onError: (error) => {
      console.error('TRPC billing query error:', error)
    },
  })

  const openPortalMutation = trpc.billing.openCustomerPortal.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank')
      }
    },
    onError: (error) => {
      console.error('Error opening portal:', error)
      alert('Failed to open customer portal. Please try again.')
    },
  })

  const cancelMutation = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      refetch()
      alert('Subscription scheduled for cancellation')
    },
    onError: (error) => {
      console.error('Error cancelling subscription:', error)
      alert('Failed to cancel subscription. Please try again.')
    },
  })

  const reactivateMutation = trpc.billing.reactivateSubscription.useMutation({
    onSuccess: () => {
      refetch()
      alert('Subscription reactivated successfully')
    },
    onError: (error) => {
      console.error('Error reactivating subscription:', error)
      alert('Failed to reactivate subscription. Please try again.')
    },
  })

  // Hide success message after 5 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setSuccessVisible(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showSuccess])

  if (isLoading) {
    return <BillingLoadingState />
  }

  if (error) {
    return <BillingErrorState error={error.message} onRetry={() => refetch()} />
  }

  if (!billingData) {
    return (
      <BillingErrorState
        error="No billing data available"
        onRetry={() => refetch()}
      />
    )
  }

  // Destructure with safe defaults
  const {
    subscription = null,
    currentPlan = null,
    planLimits = {
      maxUsers: 1,
      maxProjects: 1,
      maxApiCalls: 100,
      features: {
        prioritySupport: false,
        advancedAnalytics: false,
        teamCollaboration: false,
        customIntegrations: false,
      },
    },
    currentPricingPlan = null,
    currentUsage = { users: 1, projects: 0, apiCalls: 0 },
    usagePercentages = { users: 0, projects: 0, apiCalls: 0 },
  } = billingData

  // Add safety check for essential data
  if (!planLimits || !currentUsage || !usagePercentages) {
    console.warn('Missing essential billing data:', {
      currentPlan,
      planLimits,
      currentUsage,
      usagePercentages,
    })
    return <BillingLoadingState />
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {successVisible && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>Payment successful! Your subscription has been updated.</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          {!currentPlan && (
            <Button onClick={() => setUpgradeModalOpen(true)} size="lg">
              Choose Plan
            </Button>
          )}
        </div>

        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Current Plan</span>
                <Badge className={getPlanColor(currentPlan)}>
                  {currentPlan
                    ? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)
                    : 'No Subscription'}
                </Badge>
              </div>
              {currentPricingPlan && (
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {currentPricingPlan.price.monthly}
                  </div>
                  <div className="text-sm text-gray-500">per month</div>
                </div>
              )}
            </CardTitle>
            {currentPricingPlan && (
              <CardDescription>
                {currentPricingPlan.description}
              </CardDescription>
            )}
          </CardHeader>

          {subscription && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Status:</span>
                  <Badge className={getStatusColor(subscription.status)}>
                    {subscription.status
                      ? subscription.status.charAt(0).toUpperCase() +
                        subscription.status.slice(1)
                      : 'Unknown'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Next billing:</span>
                  <span className="font-medium">
                    {new Date(
                      subscription.currentPeriodEnd
                    ).toLocaleDateString()}
                  </span>
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">Cancels at period end</span>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Usage & Limits Card */}
        <Card>
          <CardHeader>
            <CardTitle>Usage & Limits</CardTitle>
            <CardDescription>
              Your current usage across all plan limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Users */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">Users</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {currentUsage.users} /{' '}
                    {planLimits.maxUsers === -1 ? '∞' : planLimits.maxUsers}
                  </span>
                </div>
                {planLimits.maxUsers !== -1 && (
                  <Progress value={usagePercentages.users} className="h-2" />
                )}
              </div>

              {/* Projects */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">Projects</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {currentUsage.projects} /{' '}
                    {planLimits.maxProjects === -1
                      ? '∞'
                      : planLimits.maxProjects}
                  </span>
                </div>
                {planLimits.maxProjects !== -1 && (
                  <Progress value={usagePercentages.projects} className="h-2" />
                )}
              </div>

              {/* API Calls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">API Calls</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {currentUsage.apiCalls.toLocaleString()} /{' '}
                    {planLimits.maxApiCalls === -1
                      ? '∞'
                      : planLimits.maxApiCalls.toLocaleString()}
                  </span>
                </div>
                {planLimits.maxApiCalls !== -1 && (
                  <Progress value={usagePercentages.apiCalls} className="h-2" />
                )}
                <div className="text-xs text-gray-500">This month</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Features Card */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Features</CardTitle>
            <CardDescription>
              Features included in your current plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries({
                'Priority Support': planLimits.features.prioritySupport,
                'Advanced Analytics': planLimits.features.advancedAnalytics,
                'Team Collaboration': planLimits.features.teamCollaboration,
                'Custom Integrations': planLimits.features.customIntegrations,
              }).map(([feature, enabled]) => (
                <div
                  key={feature}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    enabled
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  {enabled ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Management */}
        {subscription && (
          <Card>
            <CardHeader>
              <CardTitle>Subscription Management</CardTitle>
              <CardDescription>
                Manage your subscription settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">Customer Portal</h4>
                    <p className="text-sm text-gray-600">
                      Access your Polar customer portal to manage payment
                      methods, download invoices, and update billing
                      information.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => openPortalMutation.mutate()}
                    disabled={openPortalMutation.isPending}
                  >
                    {openPortalMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Opening...
                      </>
                    ) : (
                      'Open Portal'
                    )}
                  </Button>
                </div>

                {subscription.status === 'active' &&
                  !subscription.cancelAtPeriodEnd && (
                    <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div>
                        <h4 className="font-medium text-yellow-800">
                          Cancel Subscription
                        </h4>
                        <p className="text-sm text-yellow-700">
                          Your subscription will remain active until the end of
                          your billing period.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                        onClick={() => {
                          if (
                            confirm(
                              'Are you sure you want to cancel your subscription? It will remain active until the end of your billing period.'
                            )
                          ) {
                            cancelMutation.mutate({
                              reason: 'User requested cancellation',
                            })
                          }
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        {cancelMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Cancelling...
                          </>
                        ) : (
                          'Cancel Plan'
                        )}
                      </Button>
                    </div>
                  )}

                {subscription.cancelAtPeriodEnd && (
                  <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-orange-800">
                        Subscription Scheduled for Cancellation
                      </h4>
                      <p className="text-sm text-orange-700">
                        Your subscription will end on{' '}
                        {new Date(
                          subscription.currentPeriodEnd
                        ).toLocaleDateString()}
                        . You can reactivate it anytime before then.
                      </p>
                    </div>
                    <Button
                      className="bg-orange-600 hover:bg-orange-700"
                      onClick={() => {
                        if (
                          confirm(
                            'Are you sure you want to reactivate your subscription?'
                          )
                        ) {
                          reactivateMutation.mutate()
                        }
                      }}
                      disabled={reactivateMutation.isPending}
                    >
                      {reactivateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Reactivating...
                        </>
                      ) : (
                        'Reactivate'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upgrade section for no subscription */}
        {!currentPlan && (
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Ready to get started?
                </h3>
                <p className="text-gray-600">
                  Choose from Hobby, Pro or Team plans to get access to advanced
                  features, higher limits, and priority support.
                </p>
                <Button onClick={() => setUpgradeModalOpen(true)} size="lg">
                  View Plan Options
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentPlan={currentPlan}
        userId={user.id}
      />
    </div>
  )
}

function BillingLoadingState() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        </div>

        {/* Current Plan Skeleton */}
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Skeleton */}
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Features Skeleton */}
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BillingErrorState({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <XCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900">
                Something went wrong
              </h3>
              <p className="text-gray-600">{error}</p>
              <Button onClick={onRetry}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
