import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { env } from '@/env'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const checkoutId = searchParams.get('checkout_id')

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return NextResponse.redirect(
      new URL('/sign-in', env.NEXT_PUBLIC_FRONTEND_BASE_URL)
    )
  }

  console.log('Checkout ID', checkoutId)

  // Redirect to billing page with success parameter
  return NextResponse.redirect(
    new URL(
      `/billing?success=true${checkoutId ? `&checkout_id=${checkoutId}` : ''}`,
      env.NEXT_PUBLIC_FRONTEND_BASE_URL
    )
  )
}
