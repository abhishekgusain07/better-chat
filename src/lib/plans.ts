export type PlanType = 'starter' | 'pro' | 'enterprise'

export interface PlanLimits {
  maxUsers: number
  maxProjects: number
  maxApiCalls: number
  features: {
    prioritySupport: boolean
    advancedAnalytics: boolean
    teamCollaboration: boolean
    customIntegrations: boolean
  }
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  starter: {
    maxUsers: 1,
    maxProjects: 10,
    maxApiCalls: 5000,
    features: {
      prioritySupport: false,
      advancedAnalytics: true,
      teamCollaboration: false,
      customIntegrations: false,
    },
  },
  pro: {
    maxUsers: 5,
    maxProjects: 25,
    maxApiCalls: 10000,
    features: {
      prioritySupport: true,
      advancedAnalytics: true,
      teamCollaboration: false,
      customIntegrations: false,
    },
  },
  enterprise: {
    maxUsers: -1, // unlimited
    maxProjects: -1, // unlimited
    maxApiCalls: -1, // unlimited
    features: {
      prioritySupport: true,
      advancedAnalytics: true,
      teamCollaboration: true,
      customIntegrations: true,
    },
  },
}

export interface PricingPlan {
  title: string
  description: string
  price: {
    monthly: string
    yearly: string
  }
  features: string[]
  popular?: boolean
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    title: 'Starter',
    description: 'Perfect for personal projects',
    price: {
      monthly: '$10',
      yearly: '$100',
    },
    features: [
      '1 user',
      '10 projects',
      '5,000 API calls/month',
      'Advanced analytics',
    ],
  },
  {
    title: 'Pro',
    description: 'For growing businesses',
    price: {
      monthly: '$20',
      yearly: '$200',
    },
    features: [
      'Up to 5 users',
      '25 projects',
      '10,000 API calls/month',
      'Priority support',
      'Advanced analytics',
    ],
    popular: true,
  },
  {
    title: 'Enterprise',
    description: 'For large teams and enterprises',
    price: {
      monthly: '$100',
      yearly: '$1000',
    },
    features: [
      'Unlimited users',
      'Unlimited projects',
      'Unlimited API calls',
      'Priority support',
      'Advanced analytics',
      'Team collaboration',
      'Custom integrations',
    ],
  },
]

/**
 * Get the plan type from user subscription
 */
export function getUserPlan(
  subscription?: { plan: string; status: string } | null
): PlanType | null {
  if (!subscription?.plan || subscription?.status !== 'active') {
    return null
  }

  const plan = subscription.plan.toLowerCase()
  if (plan === 'starter') return 'starter'
  if (plan === 'pro') return 'pro'
  if (plan === 'enterprise') return 'enterprise'

  return null
}

/**
 * Check if a user can perform a specific action based on their plan
 */
export function canPerformAction(
  plan: PlanType | null,
  action: keyof PlanLimits['features']
): boolean {
  if (!plan) return false
  return PLAN_LIMITS[plan].features[action]
}

/**
 * Check if a user is within their usage limits
 */
export function isWithinLimits(
  plan: PlanType | null,
  usage: {
    users?: number
    projects?: number
    apiCalls?: number
  }
): {
  isWithin: boolean
  violations: string[]
} {
  const limits = getPlanLimits(plan)
  const violations: string[] = []

  if (usage.users && limits.maxUsers > 0 && usage.users > limits.maxUsers) {
    violations.push(
      `User count (${usage.users}) exceeds limit (${limits.maxUsers})`
    )
  }

  if (
    usage.projects &&
    limits.maxProjects > 0 &&
    usage.projects > limits.maxProjects
  ) {
    violations.push(
      `Project count (${usage.projects}) exceeds limit (${limits.maxProjects})`
    )
  }

  if (
    usage.apiCalls &&
    limits.maxApiCalls > 0 &&
    usage.apiCalls > limits.maxApiCalls
  ) {
    violations.push(
      `API calls (${usage.apiCalls}) exceed limit (${limits.maxApiCalls})`
    )
  }

  return {
    isWithin: violations.length === 0,
    violations,
  }
}

/**
 * Get remaining usage for a user's plan
 */
export function getRemainingUsage(
  plan: PlanType | null,
  usage: {
    users?: number
    projects?: number
    apiCalls?: number
  }
): {
  users: number | 'unlimited'
  projects: number | 'unlimited'
  apiCalls: number | 'unlimited'
} {
  const limits = getPlanLimits(plan)

  return {
    users:
      limits.maxUsers === -1
        ? 'unlimited'
        : Math.max(0, limits.maxUsers - (usage.users || 0)),
    projects:
      limits.maxProjects === -1
        ? 'unlimited'
        : Math.max(0, limits.maxProjects - (usage.projects || 0)),
    apiCalls:
      limits.maxApiCalls === -1
        ? 'unlimited'
        : Math.max(0, limits.maxApiCalls - (usage.apiCalls || 0)),
  }
}

/**
 * Get plan limits for a specific plan
 */
export function getPlanLimits(plan: PlanType | null): PlanLimits {
  if (!plan) {
    // Default limits for users without subscription
    return {
      maxUsers: 1,
      maxProjects: 1,
      maxApiCalls: 100,
      features: {
        prioritySupport: false,
        advancedAnalytics: false,
        teamCollaboration: false,
        customIntegrations: false,
      },
    }
  }
  return PLAN_LIMITS[plan]
}
