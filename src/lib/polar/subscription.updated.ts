'use server'

import { db } from '@/db'
import { subscription } from '@/db/schema'
import type { WebhookSubscriptionUpdatedPayload } from '@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload.js'
import { eq } from 'drizzle-orm'

type PlanType = 'starter' | 'pro' | 'enterprise'
type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'expired'

function getPlanType(productName: string): PlanType | null {
  const plan = productName.toLowerCase()
  if (plan === 'starter') {
    return 'starter'
  }
  if (plan === 'pro') {
    return 'pro'
  }
  if (plan === 'enterprise') {
    return 'enterprise'
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
  console.log('🔔 WEBHOOK: subscription.updated received', {
    subscriptionId: payload.data.id,
    customerId: payload.data.customer.id,
    externalId: payload.data.customer.externalId,
    productName: payload.data.product.name,
    status: payload.data.status,
    timestamp: new Date().toISOString(),
  })

  const { data: subscriptionData } = payload
  const userId = subscriptionData.customer.externalId

  if (typeof userId !== 'string') {
    console.error(
      '❌ subscription.updated webhook received without a string userId in customer.externalId',
      { externalId: userId, customerId: subscriptionData.customer.id }
    )
    return
  }

  const existingSubscription = await db
    .select()
    .from(subscription)
    .where(eq(subscription.polarId, subscriptionData.id))
    .limit(1)
    .then((rows) => rows[0] || null)

  const plan = getPlanType(subscriptionData.product.name)
  if (!plan) {
    console.error(`❌ Unknown plan: ${subscriptionData.product.name}`)
    return
  }

  const status = getSubscriptionStatus(subscriptionData.status)
  if (!status) {
    console.error(
      `❌ Unknown subscription status from Polar: ${subscriptionData.status}`
    )
    return
  }

  if (
    !subscriptionData.currentPeriodStart ||
    !subscriptionData.currentPeriodEnd
  ) {
    console.error(
      '❌ subscription.updated webhook received without currentPeriodStart or currentPeriodEnd'
    )
    return
  }

  try {
    if (!existingSubscription) {
      // CREATE new subscription (subscription.updated can be sent for new subscriptions)
      const { nanoid } = await import('nanoid')
      const { user } = await import('@/db/schema')
      const { eq } = await import('drizzle-orm')

      // Verify user exists
      const userExists = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
        .then((rows) => rows[0] || null)
      if (!userExists) {
        console.error(`❌ User with id ${userId} not found.`)
        return
      }

      const subscriptionRecord = {
        id: nanoid(),
        polarId: subscriptionData.id,
        plan,
        status,
        currentPeriodStart: new Date(subscriptionData.currentPeriodStart),
        currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd),
        userId: userId,
        cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false,
        canceledAt: subscriptionData.canceledAt
          ? new Date(subscriptionData.canceledAt)
          : null,
        endsAt: subscriptionData.endsAt
          ? new Date(subscriptionData.endsAt)
          : null,
        endedAt: subscriptionData.endedAt
          ? new Date(subscriptionData.endedAt)
          : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      console.log(
        '📝 Creating subscription record from updated webhook:',
        subscriptionRecord
      )

      await db.insert(subscription).values(subscriptionRecord)

      console.log('✅ Successfully created subscription for user', {
        userId,
        subscriptionId: subscriptionRecord.id,
        polarId: subscriptionData.id,
        plan,
        status,
      })
    } else {
      // UPDATE existing subscription
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
        `✅ Successfully updated subscription ${subscriptionData.id} for user ${existingSubscription.userId}`
      )
    }
  } catch (error) {
    console.error('❌ Error creating/updating subscription in DB:', error)
    console.error('📊 Subscription data:', {
      userId,
      polarId: subscriptionData.id,
      plan,
      status,
      productName: subscriptionData.product.name,
    })
  }
}
