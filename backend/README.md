# Chat App Backend

A Node.js + Express + TypeScript backend for the chat application with WebSocket support for real-time communication.

## Features

- 🚀 **Express.js** server with TypeScript
- 🔌 **WebSocket** support via Socket.IO for real-time chat
- 🔐 **Authentication** with JWT and better-auth integration
- 🗄️ **Database** integration with Drizzle ORM and PostgreSQL
- 🤖 **LLM Provider** support (Anthropic, OpenAI, Google)
- 💳 **Billing** integration with Polar
- 📁 **File Upload** support with Multer and Sharp
- 🛡️ **Security** middleware (Helmet, CORS, Rate Limiting)
- 📊 **Logging** and monitoring
- 🧪 **Testing** setup with Jest

## Project Structure

```
backend/
├── src/
│   ├── auth/          # Authentication logic
│   ├── db/            # Database schema and connection
│   ├── middleware/    # Custom middleware
│   ├── providers/     # LLM provider integrations
│   ├── routes/        # API routes
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   ├── websocket/     # WebSocket handlers
│   ├── env.ts         # Environment configuration
│   └── index.ts       # Main server file
├── uploads/           # File upload directory
├── dist/             # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database setup:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Development:**
   ```bash
   npm run dev
   ```

5. **Production build:**
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

See `.env.example` for all required environment variables. Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Secret for authentication
- `JWT_SECRET`: Secret for JWT tokens
- `FRONTEND_URL`: Frontend application URL
- `ANTHROPIC_API_KEY`: Anthropic API key (optional)
- `OPENAI_API_KEY`: OpenAI API key (optional)

## API Endpoints

- `GET /health` - Health check
- `GET /api/v1` - API information
- `POST /api/v1/auth/*` - Authentication endpoints
- `GET|POST|PUT|DELETE /api/v1/chat/*` - Chat management
- `POST /api/v1/billing/*` - Billing and subscriptions
- `GET /api/v1/providers/*` - LLM provider information

## WebSocket Events

### Client to Server
- `authenticate` - Authenticate connection
- `joinConversation` - Join a conversation room
- `leaveConversation` - Leave a conversation room
- `sendMessage` - Send a message
- `approveToolExecution` - Approve tool execution
- `rejectToolExecution` - Reject tool execution

### Server to Client
- `authenticated` - Authentication successful
- `messageReceived` - New message received
- `messageStreaming` - Streaming message content
- `toolExecutionStarted` - Tool execution started
- `toolExecutionCompleted` - Tool execution completed
- `conversationUpdated` - Conversation updated
- `error` - Error occurred

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run typecheck` - Type checking
- `npm run db:generate` - Generate database migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open database studio

## Architecture

This backend is designed to work with a React frontend and supports:

1. **RESTful API** for standard CRUD operations
2. **WebSocket connections** for real-time features
3. **LLM streaming** for chat responses
4. **Tool execution** with approval workflows
5. **File handling** for uploads and processing
6. **Billing integration** for subscription management

## Development

The server uses TypeScript with path aliases for clean imports:

```typescript
import { logger } from '@/utils/logger'
import { env } from '@/env'
import { authMiddleware } from '@/middleware/auth'
```

Hot reload is enabled in development mode using `tsx watch`.