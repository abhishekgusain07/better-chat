import express from 'express'
import { logger } from '@/utils/logger'

// Import route modules
import { authRoutes } from './auth'
import { chatRoutes } from './chat'
import { testRoutes } from './test'
// import { billingRoutes } from './billing'
// import { providersRoutes } from './providers'

export const setupRoutes = (app: express.Application): void => {
  // API version prefix
  const apiV1 = express.Router()

  // Basic API info endpoint
  apiV1.get('/', (req, res) => {
    res.json({
      message: 'Chat App API v1',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: '/api/v1/auth',
        chat: '/api/v1/chat',
        test: '/api/v1/test',
        // billing: '/api/v1/billing',
        // providers: '/api/v1/providers',
      },
      chatEndpoints: {
        'GET /chat/conversations': 'Get user conversations',
        'POST /chat/conversations': 'Create new conversation',
        'GET /chat/conversations/:id': 'Get conversation with messages',
        'PUT /chat/conversations/:id': 'Update conversation',
        'DELETE /chat/conversations/:id': 'Delete conversation',
        'POST /chat/conversations/:id/messages': 'Send message',
        'GET /chat/conversations/:id/stats': 'Get conversation stats',
      },
    })
  })

  // Mount route modules
  apiV1.use('/auth', authRoutes)
  apiV1.use('/chat', chatRoutes)
  apiV1.use('/test', testRoutes)
  // apiV1.use('/billing', billingRoutes)
  // apiV1.use('/providers', providersRoutes)

  // Mount API router
  app.use('/api/v1', apiV1)

  logger.info('API routes setup completed')
}
