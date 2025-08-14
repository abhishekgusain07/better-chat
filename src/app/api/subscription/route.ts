import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { eq } from 'drizzle-orm'
import { subscription } from '@/db/schema'

export async function GET(request: NextRequest) {
  try {
    // Get the session from better-auth
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the user's subscription
    const userSubscription = await db.query.subscription.findFirst({
      where: eq(subscription.userId, session.user.id),
      orderBy: (subscription, { desc }) => [desc(subscription.createdAt)],
    })

    if (!userSubscription) {
      return NextResponse.json({ subscription: null })
    }

    // Return the subscription data
    return NextResponse.json({
      subscription: {
        ...userSubscription,
        currentPeriodStart: userSubscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: userSubscription.currentPeriodEnd.toISOString(),
        canceledAt: userSubscription.canceledAt?.toISOString() || null,
        endsAt: userSubscription.endsAt?.toISOString() || null,
        endedAt: userSubscription.endedAt?.toISOString() || null,
        createdAt: userSubscription.createdAt.toISOString(),
        updatedAt: userSubscription.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}
