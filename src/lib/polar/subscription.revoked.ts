'use server'

import { db } from '@/db'
import { subscription } from '@/db/schema'
import type { WebhookSubscriptionRevokedPayload } from '@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload.js'
import { eq } from 'drizzle-orm'

export async function handleSubscriptionRevoked(
  payload: WebhookSubscriptionRevokedPayload
) {
  const { data: subscriptionData } = payload

  const existingSubscription = await db.query.subscription.findFirst({
    where: (subscriptions, { eq }) =>
      eq(subscriptions.polarId, subscriptionData.id),
  })

  if (!existingSubscription) {
    console.error(
      `subscription.revoked webhook received for a subscription that does not exist: ${subscriptionData.id}`
    )
    return
  }

  try {
    await db
      .update(subscription)
      .set({
        status: 'expired',
        endedAt: subscriptionData.endedAt
          ? new Date(subscriptionData.endedAt)
          : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscription.polarId, subscriptionData.id))

    console.log(
      `Successfully marked subscription ${subscriptionData.id} as revoked for user ${existingSubscription.userId}`
    )
  } catch (error) {
    console.error('Error updating subscription to revoked in DB:', error)
  }
}
