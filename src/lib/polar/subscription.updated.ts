'use server'

import { db } from '@/db'
import { subscription } from '@/db/schema'
import type { WebhookSubscriptionUpdatedPayload } from '@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload.js'
import { eq } from 'drizzle-orm'

type PlanType = 'pro' | 'team'
type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'expired'

function getPlanType(productName: string): PlanType | null {
  const plan = productName.toLowerCase()
  if (plan === 'pro') {
    return 'pro'
  }
  if (plan === 'team') {
    return 'team'
  }
  return null
}

function getSubscriptionStatus(
  polarStatus: WebhookSubscriptionUpdatedPayload['data']['status']
): SubscriptionStatus | null {
  switch (polarStatus) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'canceled':
      return 'cancelled'
    case 'past_due':
    case 'incomplete':
    case 'unpaid':
      return 'past_due'
    case 'incomplete_expired':
      return 'expired'
    default:
      return null
  }
}

export async function handleSubscriptionUpdated(
  payload: WebhookSubscriptionUpdatedPayload
) {
  const { data: subscriptionData } = payload

  const existingSubscription = await db
    .select()
    .from(subscription)
    .where(eq(subscription.polarId, subscriptionData.id))
    .limit(1)
    .then((rows) => rows[0] || null)

  if (!existingSubscription) {
    console.error(
      `subscription.updated webhook received for a subscription that does not exist: ${subscriptionData.id}`
    )
    return
  }

  const plan = getPlanType(subscriptionData.product.name)
  if (!plan) {
    console.error(`Unknown plan: ${subscriptionData.product.name}`)
    return
  }

  const status = getSubscriptionStatus(subscriptionData.status)
  if (!status) {
    console.error(
      `Unknown subscription status from Polar: ${subscriptionData.status}`
    )
    return
  }

  if (
    !subscriptionData.currentPeriodStart ||
    !subscriptionData.currentPeriodEnd
  ) {
    console.error(
      'subscription.updated webhook received without currentPeriodStart or currentPeriodEnd'
    )
    return
  }

  try {
    await db
      .update(subscription)
      .set({
        plan,
        status,
        currentPeriodStart: new Date(subscriptionData.currentPeriodStart),
        currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd),
        cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false,
        canceledAt: subscriptionData.canceledAt
          ? new Date(subscriptionData.canceledAt)
          : null,
        endedAt: subscriptionData.endedAt
          ? new Date(subscriptionData.endedAt)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(subscription.polarId, subscriptionData.id))

    console.log(
      `Successfully updated subscription ${subscriptionData.id} for user ${existingSubscription.userId}`
    )
  } catch (error) {
    console.error('Error updating subscription in DB:', error)
  }
}
