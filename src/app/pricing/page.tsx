'use client'

import { Button } from '@/components/ui/button'
import { CheckIcon } from '@/components/checkicon'
import { PRICING_PLANS } from '@/lib/plans'
import { checkout, useSession } from '@/lib/auth-client'
import { useState } from 'react'
import Link from 'next/link'

export default function PricingPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckout = async (planSlug: string) => {
    if (!session?.user?.id) {
      // Redirect to sign in if not authenticated
      window.location.href = '/sign-in'
      return
    }

    setLoading(planSlug)

    try {
      await checkout({
        slug: planSlug,
        referenceId: session.user.id,
      })
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="container mx-auto py-16 px-4">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-gray-600 mb-8">
          Choose the perfect plan for your needs. Upgrade or downgrade at any
          time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.title}
            className={`relative border rounded-2xl p-8 ${
              plan.popular
                ? 'border-blue-500 shadow-xl ring-2 ring-blue-500 ring-opacity-20'
                : 'border-gray-200'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">{plan.title}</h2>
              <p className="text-gray-600 mb-6">{plan.description}</p>

              <div className="mb-6">
                <span className="text-5xl font-bold">{plan.price.monthly}</span>
                <span className="text-gray-600">/month</span>
              </div>

              <div className="text-sm text-gray-600">
                Save with yearly:{' '}
                <span className="font-medium">{plan.price.yearly}</span>/year
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckIcon />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              {plan.title.toLowerCase() === 'free' ? (
                session?.user ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Link href="/sign-up">
                    <Button variant="outline" className="w-full">
                      Get Started
                    </Button>
                  </Link>
                )
              ) : (
                <Button
                  className={`w-full ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                      : ''
                  }`}
                  onClick={() => handleCheckout(plan.title.toLowerCase())}
                  disabled={loading === plan.title.toLowerCase()}
                >
                  {loading === plan.title.toLowerCase()
                    ? 'Processing...'
                    : session?.user
                      ? 'Upgrade Now'
                      : 'Get Started'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-16">
        <p className="text-gray-600 mb-4">
          All plans include a 14-day free trial. No credit card required.
        </p>
        <p className="text-sm text-gray-500">
          Questions?{' '}
          <Link href="/support" className="text-blue-600 hover:underline">
            Contact our support team
          </Link>
        </p>
      </div>
    </div>
  )
}
