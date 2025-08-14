'use client'

import { Button } from '@/components/ui/button'
import { CheckIcon } from '@/components/checkicon'
import { useState } from 'react'
import { checkout } from '@/lib/auth-client'
import { PRICING_PLANS } from '@/lib/plans'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlan?: string
  userId?: string
}

export function UpgradeModal({
  isOpen,
  onClose,
  currentPlan,
  userId,
}: UpgradeModalProps) {
  const [checkoutLoading, setCheckoutLoading] = useState<'pro' | 'team' | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async (plan: 'pro' | 'team') => {
    if (!userId) {
      setError('Please sign in to upgrade your plan')
      return
    }

    setCheckoutLoading(plan)
    setError(null)

    try {
      console.log('Starting checkout for plan:', plan, 'with user ID:', userId)

      const result = await checkout({
        slug: plan,
        referenceId: userId,
      })

      console.log('Checkout result:', result)

      // If we get here without an error, the checkout should have redirected
      // If no redirect happened, it might be an issue with the setup
      if (!result) {
        throw new Error(
          'Checkout failed to initialize. Please check your configuration.'
        )
      }
    } catch (error: any) {
      console.error('Checkout error:', error)

      // Set user-friendly error messages
      if (error?.message?.includes('404')) {
        setError('Payment service unavailable. Please try again later.')
      } else if (
        error?.message?.includes('authentication') ||
        error?.message?.includes('401')
      ) {
        setError('Please sign in again to continue with the upgrade.')
      } else if (error?.message?.includes('configuration')) {
        setError('Payment system is not configured. Please contact support.')
      } else {
        setError(
          error?.message ||
            'Unable to start checkout. Please try again or contact support.'
        )
      }
    } finally {
      setCheckoutLoading(null)
      // Don't close the modal on error, let user see the error message
    }
  }

  const clearError = () => {
    setError(null)
  }

  const handleClose = () => {
    setError(null)
    setCheckoutLoading(null)
    onClose()
  }

  const renderPlanButton = (plan: 'pro' | 'team') => {
    const isCurrentPlan = currentPlan === plan
    const isLoading = checkoutLoading === plan

    if (isCurrentPlan) {
      return (
        <Button disabled variant="default" className="w-full">
          Current plan
        </Button>
      )
    }

    return (
      <Button
        disabled={!!checkoutLoading}
        className="w-full relative"
        onClick={() => handleCheckout(plan)}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Redirecting to checkout...
          </div>
        ) : (
          'Upgrade'
        )}
      </Button>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Upgrade Your Plan</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            disabled={!!checkoutLoading}
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-red-600 mt-0.5">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-red-800 font-medium">Checkout Error</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {checkoutLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Redirecting to secure checkout...</p>
              <p className="text-sm text-gray-500 mt-1">
                This may take a few moments
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.title}
              className={`border rounded-lg p-6 ${
                plan.popular ? 'border-blue-500 shadow-lg' : 'border-gray-200'
              } ${checkoutLoading ? 'opacity-50' : ''}`}
            >
              {plan.popular && (
                <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium mb-4 inline-block">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-bold mb-2">{plan.title}</h3>
              <p className="text-gray-600 mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-3xl font-bold">{plan.price.monthly}</span>
                <span className="text-gray-600"> /month</span>
              </div>

              <div className="mb-6">
                {plan.title.toLowerCase() === 'free' ? (
                  <Button disabled variant="outline" className="w-full">
                    Current plan
                  </Button>
                ) : (
                  renderPlanButton(plan.title.toLowerCase() as 'pro' | 'team')
                )}
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckIcon />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Help text */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Need help?</strong> If you're experiencing issues with
            checkout, please contact our support team. Your current plan will
            remain active until you successfully upgrade.
          </p>
        </div>
      </div>
    </div>
  )
}
