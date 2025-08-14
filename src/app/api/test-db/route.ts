import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { subscription, user } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    // Test database connection and schema
    const result = {
      timestamp: new Date().toISOString(),
      tests: [] as any[],
    }

    // Test 1: Check if subscription table exists by attempting to query it
    try {
      const subscriptionTest = await db.select().from(subscription).limit(1)

      result.tests.push({
        name: 'subscription_table_exists',
        status: 'success',
        message: 'Subscription table is accessible',
        count: subscriptionTest.length,
      })
    } catch (error: any) {
      result.tests.push({
        name: 'subscription_table_exists',
        status: 'error',
        message: error.message,
        error: error.code,
      })
    }

    // Test 2: Check if user table exists
    try {
      const userTest = await db.select().from(user).limit(1)

      result.tests.push({
        name: 'user_table_exists',
        status: 'success',
        message: 'User table is accessible',
        count: userTest.length,
      })
    } catch (error: any) {
      result.tests.push({
        name: 'user_table_exists',
        status: 'error',
        message: error.message,
        error: error.code,
      })
    }

    // Test 3: Test the exact query used in subscription API
    try {
      const testUserId = 'test-user-id'
      const subscriptionQuery = await db
        .select()
        .from(subscription)
        .where(eq(subscription.userId, testUserId))
        .orderBy(desc(subscription.createdAt))
        .limit(1)

      result.tests.push({
        name: 'subscription_query_syntax',
        status: 'success',
        message: 'Subscription query syntax is valid',
        count: subscriptionQuery.length,
      })
    } catch (error: any) {
      result.tests.push({
        name: 'subscription_query_syntax',
        status: 'error',
        message: error.message,
        error: error.code,
      })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Database test failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
