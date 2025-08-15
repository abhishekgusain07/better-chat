import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const planTypeEnum = pgEnum('plan_type', ['hobby', 'pro', 'team'])
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'trialing',
  'past_due',
  'cancelled',
  'expired',
])

export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  plan: planTypeEnum('plan').notNull(),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  polarId: text('polar_id').notNull().unique(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  canceledAt: timestamp('canceled_at'),
  endsAt: timestamp('ends_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
})
