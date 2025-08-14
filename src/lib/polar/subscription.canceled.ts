'use server'

import { db } from '@/db'
import { subscription } from '@/db/schema'
import type { WebhookSubscriptionCanceledPayload } from '@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload.js'
import { eq } from 'drizzle-orm'

export async function handleSubscriptionCanceled(
  payload: WebhookSubscriptionCanceledPayload
) {
  const { data: subscriptionData } = payload

  const existingSubscription = await db.query.subscription.findFirst({
    where: (subscriptions, { eq }) =>
      eq(subscriptions.polarId, subscriptionData.id),
  })

  if (!existingSubscription) {
    console.error(
      `subscription.canceled webhook received for a subscription that does not exist: ${subscriptionData.id}`
    )
    return
  }

  try {
    await db
      .update(subscription)
      .set({
        status: 'cancelled',
        cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false,
        canceledAt: subscriptionData.canceledAt
          ? new Date(subscriptionData.canceledAt)
          : new Date(),
        endsAt: subscriptionData.endsAt
          ? new Date(subscriptionData.endsAt)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(subscription.polarId, subscriptionData.id))

    console.log(
      `Successfully marked subscription ${subscriptionData.id} as canceled for user ${existingSubscription.userId}`
    )
  } catch (error) {
    console.error('Error updating subscription to canceled in DB:', error)
  }
}
