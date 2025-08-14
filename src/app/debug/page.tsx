'use client'

import { useSession } from '@/lib/auth-client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface DebugData {
  timestamp: string
  environment: string
  environmentVariables: Record<string, string>
  authentication: {
    session: boolean
    userId: string | null
    userEmail: string | null
  }
  polarApi: any
  missingProductIds: string[]
  recommendations: string[]
  checkoutReadiness: {
    hasAuth: boolean
    hasAccessToken: boolean
    hasProductIds: boolean
    hasWebhookSecret: boolean
    overall: boolean
  }
}

export default function DebugPage() {
  const { data: session } = useSession()
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runDiagnostics = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/debug/polar')
      if (!response.ok) {
        throw new Error(`Debug check failed: ${response.statusText}`)
      }

      const data = await response.json()
      setDebugData(data)
    } catch (err) {
      console.error('Debug error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      runDiagnostics()
    }
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              Debug page is only available in development mode for security
              reasons.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Polar Payment Debug</h1>
          <Button onClick={runDiagnostics} disabled={loading}>
            {loading ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-blue-800">Running diagnostics...</p>
          </div>
        )}

        {debugData && (
          <div className="space-y-6">
            {/* Overall Status */}
            <div
              className={`rounded-lg p-6 ${
                debugData.checkoutReadiness.overall
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              } border`}
            >
              <h2
                className={`text-xl font-bold mb-2 ${
                  debugData.checkoutReadiness.overall
                    ? 'text-green-800'
                    : 'text-red-800'
                }`}
              >
                {debugData.checkoutReadiness.overall
                  ? '✅ Ready for Checkout'
                  : '❌ Checkout Not Ready'}
              </h2>
              <p
                className={`${
                  debugData.checkoutReadiness.overall
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}
              >
                {debugData.checkoutReadiness.overall
                  ? 'All requirements are met for payment processing.'
                  : 'Some configuration is missing or incorrect.'}
              </p>
            </div>

            {/* Recommendations */}
            {debugData.recommendations.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-yellow-800 mb-4">
                  🔧 Recommendations
                </h2>
                <ul className="space-y-2">
                  {debugData.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      className="text-yellow-700 flex items-start gap-2"
                    >
                      <span className="text-yellow-500">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Environment Variables */}
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Environment Variables</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(debugData.environmentVariables).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between items-center p-3 border rounded"
                    >
                      <span className="font-mono text-sm">{key}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          value === 'Set'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {value}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Authentication Status */}
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Authentication</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Session Active:</span>
                  <span
                    className={`font-medium ${debugData.authentication.session ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {debugData.authentication.session ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>User ID:</span>
                  <span className="font-mono text-sm">
                    {debugData.authentication.userId || 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="font-mono text-sm">
                    {debugData.authentication.userEmail || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Polar API Status */}
            {debugData.polarApi && (
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Polar API Connection</h2>
                {debugData.polarApi.error ? (
                  <div className="text-red-600">
                    <p className="font-medium">Connection Failed</p>
                    <p className="text-sm">{debugData.polarApi.message}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span
                        className={`font-medium ${debugData.polarApi.accessible ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {debugData.polarApi.status} -{' '}
                        {debugData.polarApi.statusText}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accessible:</span>
                      <span
                        className={`font-medium ${debugData.polarApi.accessible ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {debugData.polarApi.accessible ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Checkout Readiness Breakdown */}
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Checkout Requirements</h2>
              <div className="space-y-3">
                {Object.entries(debugData.checkoutReadiness).map(
                  ([key, value]) => {
                    if (key === 'overall') return null

                    const labels = {
                      hasAuth: 'User Authentication',
                      hasAccessToken: 'Polar Access Token',
                      hasProductIds: 'Product IDs Configured',
                      hasWebhookSecret: 'Webhook Secret Set',
                    }

                    return (
                      <div
                        key={key}
                        className="flex justify-between items-center"
                      >
                        <span>{labels[key as keyof typeof labels]}</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            value
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {value ? '✅ Ready' : '❌ Missing'}
                        </span>
                      </div>
                    )
                  }
                )}
              </div>
            </div>

            {/* Debug Info */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <p className="text-sm text-gray-600">
                Debug run at: {new Date(debugData.timestamp).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                Environment: {debugData.environment}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
