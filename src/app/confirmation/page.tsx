import Link from 'next/link'

export default function Page({
  searchParams: { checkoutId },
}: {
  searchParams: {
    checkoutId: string
  }
}) {
  // Checkout has been confirmed
  // The subscription will be created via webhooks

  return (
    <div className="container mx-auto py-16 px-4 text-center">
      <div className="max-w-md mx-auto">
        <div className="mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-gray-600">
            Thank you for your purchase. Your subscription is being processed
            and will be activated shortly.
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/billing">
            <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              View Billing Dashboard
            </button>
          </Link>
          <Link href="/dashboard">
            <button className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors">
              Continue to Dashboard
            </button>
          </Link>
        </div>

        {checkoutId && (
          <p className="text-xs text-gray-500 mt-4">
            Checkout ID: {checkoutId}
          </p>
        )}
      </div>
    </div>
  )
}
