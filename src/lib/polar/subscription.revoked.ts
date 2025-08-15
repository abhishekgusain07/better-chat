'use server'

import { db } from '@/db'
import { subscription } from '@/db/schema'
import type { WebhookSubscriptionRevokedPayload } from '@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload.js'
import { eq } from 'drizzle-orm'

export async function handleSubscriptionRevoked(
  payload: WebhookSubscriptionRevokedPayload
) {
  console.log('🔔 WEBHOOK: subscription.revoked received', {
    subscriptionId: payload.data.id,
    customerId: payload.data.customer.id,
    externalId: payload.data.customer.externalId,
    timestamp: new Date().toISOString(),
  })

  const { data: subscriptionData } = payload

  const existingSubscription = await db
    .select()
    .from(subscription)
    .where(eq(subscription.polarId, subscriptionData.id))
    .limit(1)
    .then((rows) => rows[0] || null)

  if (!existingSubscription) {
    console.error(
      `❌ subscription.revoked webhook received for a subscription that does not exist: ${subscriptionData.id}`
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
      `✅ Successfully marked subscription ${subscriptionData.id} as revoked for user ${existingSubscription.userId}`
    )
  } catch (error) {
    console.error('❌ Error updating subscription to revoked in DB:', error)
  }
}
