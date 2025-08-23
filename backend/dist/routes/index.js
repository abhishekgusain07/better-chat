'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.setupRoutes = void 0
const express_1 = __importDefault(require('express'))
const logger_1 = require('@/utils/logger')
const auth_1 = require('./auth')
const chat_1 = require('./chat')
const test_1 = require('./test')
const setupRoutes = (app) => {
  const apiV1 = express_1.default.Router()
  apiV1.get('/', (req, res) => {
    res.json({
      message: 'Chat App API v1',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: '/api/v1/auth',
        chat: '/api/v1/chat',
        test: '/api/v1/test',
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
  apiV1.use('/auth', auth_1.authRoutes)
  apiV1.use('/chat', chat_1.chatRoutes)
  apiV1.use('/test', test_1.testRoutes)
  app.use('/api/v1', apiV1)
  logger_1.logger.info('API routes setup completed')
}
exports.setupRoutes = setupRoutes
//# sourceMappingURL=index.js.map
