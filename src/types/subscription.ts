export interface Subscription {
  id: string
  userId: string
  plan: 'pro' | 'team'
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired'
  polarId: string
  currentPeriodStart: Date | string
  currentPeriodEnd: Date | string
  cancelAtPeriodEnd: boolean
  canceledAt: Date | string | null
  endsAt: Date | string | null
  endedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface SubscriptionWithUser extends Subscription {
  user: {
    id: string
    name: string
    email: string
  }
}
