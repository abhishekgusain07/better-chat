import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool } from '@neondatabase/serverless'
import { env } from '@/env'
import * as schema from './schema'
import { logger } from '@/utils/logger'

// Create connection pool for better performance
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Connection pool configuration
  min: 1,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Add connection event listeners for monitoring
pool.on('connect', () => {
  logger.debug('Database connection established')
})

pool.on('error', (err: Error) => {
  logger.error('Database connection error:', err)
})

// Initialize Drizzle with schema
export const db = drizzle(pool, {
  schema,
  logger:
    env.NODE_ENV === 'development'
      ? {
          logQuery: (query, params) => {
            logger.debug('Database query:', { query, params })
          },
        }
      : false,
})

// Export pool for direct queries if needed
export { pool }

// Helper function to check database connection
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1')
    logger.info('✅ Database connection successful')
    return true
  } catch (error) {
    logger.error('❌ Database connection failed:', error)
    return false
  }
}
