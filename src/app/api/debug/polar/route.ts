import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/env'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Only allow this in development
    if (env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Debug endpoint disabled in production' },
        { status: 403 }
      )
    }

    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    // Environment variables check
    const envCheck = {
      DATABASE_URL: !!env.DATABASE_URL ? 'Set' : 'Missing',
      BETTER_AUTH_SECRET: !!env.BETTER_AUTH_SECRET ? 'Set' : 'Missing',
      POLAR_ACCESS_TOKEN: !!env.POLAR_ACCESS_TOKEN ? 'Set' : 'Missing',
      POLAR_WEBHOOK_SECRET: !!env.POLAR_WEBHOOK_SECRET ? 'Set' : 'Missing',
      POLAR_PRO_PRODUCT_ID: env.POLAR_PRO_PRODUCT_ID ? 'Set' : 'Missing',
      POLAR_TEAM_PRODUCT_ID: env.POLAR_TEAM_PRODUCT_ID ? 'Set' : 'Missing',
      POLAR_SUCCESS_URL: env.POLAR_SUCCESS_URL ? 'Set' : 'Missing',
      NEXT_PUBLIC_FRONTEND_BASE_URL: !!env.NEXT_PUBLIC_FRONTEND_BASE_URL
        ? 'Set'
        : 'Missing',
    }

    // Auth client configuration check
    let authClientCheck = {
      session: !!session,
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
    }

    // Product ID validation
    const missingProductIds = []
    if (!env.POLAR_PRO_PRODUCT_ID)
      missingProductIds.push('POLAR_PRO_PRODUCT_ID')
    if (!env.POLAR_TEAM_PRODUCT_ID)
      missingProductIds.push('POLAR_TEAM_PRODUCT_ID')

    // Basic Polar API test (if access token is available)
    let polarApiTest = null
    if (env.POLAR_ACCESS_TOKEN) {
      try {
        const testResponse = await fetch(
          'https://api.polar.sh/v1/organizations',
          {
            headers: {
              Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        )

        polarApiTest = {
          status: testResponse.status,
          statusText: testResponse.statusText,
          accessible: testResponse.ok,
        }
      } catch (error) {
        polarApiTest = {
          error: 'Failed to connect to Polar API',
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }

    // Generate recommendations
    const recommendations = []

    if (!env.POLAR_ACCESS_TOKEN) {
      recommendations.push(
        'Set POLAR_ACCESS_TOKEN in your environment variables'
      )
    }

    if (missingProductIds.length > 0) {
      recommendations.push(
        `Set missing product IDs: ${missingProductIds.join(', ')}`
      )
    }

    if (!env.POLAR_WEBHOOK_SECRET) {
      recommendations.push('Set POLAR_WEBHOOK_SECRET for webhook security')
    }

    if (!session) {
      recommendations.push(
        'User is not signed in - checkout requires authentication'
      )
    }

    if (polarApiTest && !polarApiTest.accessible) {
      recommendations.push(
        'Polar API is not accessible - check your access token'
      )
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      environmentVariables: envCheck,
      authentication: authClientCheck,
      polarApi: polarApiTest,
      missingProductIds,
      recommendations,
      checkoutReadiness: {
        hasAuth: !!session,
        hasAccessToken: !!env.POLAR_ACCESS_TOKEN,
        hasProductIds: missingProductIds.length === 0,
        hasWebhookSecret: !!env.POLAR_WEBHOOK_SECRET,
        overall:
          !!session &&
          !!env.POLAR_ACCESS_TOKEN &&
          missingProductIds.length === 0,
      },
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json(
      {
        error: 'Debug check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
