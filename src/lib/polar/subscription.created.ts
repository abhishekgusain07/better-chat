'use server'

import { db } from '@/db'
import { subscription, user } from '@/db/schema'
import type { WebhookSubscriptionCreatedPayload } from '@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload.js'
import { nanoid } from 'nanoid'
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
  polarStatus: WebhookSubscriptionCreatedPayload['data']['status']
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

export async function handleSubscriptionCreated(
  payload: WebhookSubscriptionCreatedPayload
) {
  const { data: subscriptionData } = payload
  const userId = subscriptionData.customer.externalId

  if (typeof userId !== 'string') {
    console.error(
      'subscription.created webhook received without a string userId in customer.externalId'
    )
    return
  }

  if (!subscriptionData.currentPeriodStart) {
    console.error(
      'subscription.created webhook received without a currentPeriodStart'
    )
    return
  }

  if (!subscriptionData.currentPeriodEnd) {
    console.error(
      'subscription.created webhook received without a currentPeriodEnd'
    )
    return
  }

  // Verify user exists using proper Drizzle syntax
  const userExists = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .then((rows) => rows[0] || null)
  if (!userExists) {
    console.error(`User with id ${userId} not found.`)
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

  try {
    await db.insert(subscription).values({
      id: nanoid(),
      polarId: subscriptionData.id,
      plan,
      status,
      currentPeriodStart: new Date(subscriptionData.currentPeriodStart),
      currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd),
      userId: userId,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log(`Successfully created subscription for user ${userId}`)
  } catch (error) {
    console.error('Error creating subscription in DB:', error)
  }
}
