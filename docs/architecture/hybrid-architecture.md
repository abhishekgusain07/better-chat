# Hybrid Architecture Guide

## 🎯 Architecture Decision

BestChatApp implements a **hybrid architecture** that combines the strengths of Next.js for UI/authentication with Node.js for real-time communication and LLM streaming. This decision was made after careful consideration of WebSocket requirements and existing authentication infrastructure.

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BestChatApp Hybrid System                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  Session Auth  ┌─────────────────┐      │
│  │   Next.js       │ ────────────► │   Node.js       │      │
│  │   Frontend      │  (better-auth  │   Backend       │      │
│  │                 │   cookies)     │                 │      │
│  │ • Authentication│               │ • Session Valid │      │
│  │ • UI Components │               │ • WebSocket     │      │
│  │ • tRPC API      │               │ • LLM Streaming │      │
│  │ • Billing       │               │ • REST API      │      │
│  └─────────────────┘               └─────────────────┘      │
│           │                                 │                │
│           │        Shared PostgreSQL       │                │
│           └──────────────┬──────────────────┘                │
│                          │                                   │
│                   ┌──────▼──────┐                            │
│                   │  Database   │                            │
│                   │             │                            │
│                   │ • Users     │                            │
│                   │ • Sessions  │                            │
│                   │ • Chat      │                            │
│                   │ • Usage     │                            │
│                   │ • Billing   │                            │
│                   └─────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## 🤔 Why Hybrid Architecture?

### The Challenge
During Sprint 01, we faced a critical architectural decision:
- **WebSocket Requirements**: Real-time chat needs WebSocket support
- **Authentication Integration**: better-auth + Polar billing was already established in Next.js
- **Next.js Limitations**: WebSocket support in Next.js API routes is limited and not ideal for streaming

### The Solution: Best of Both Worlds
Instead of choosing one or the other, we implemented a hybrid approach:

1. **Keep Next.js for what it does best**: UI, authentication, billing, user management
2. **Add Node.js for what it excels at**: Real-time communication, WebSocket handling, LLM streaming
3. **Share the database**: Single source of truth with synchronized schemas

## 🔧 Implementation Details

### Next.js Frontend Responsibilities
```typescript
// Next.js handles:
- User authentication (better-auth)
- Billing integration (Polar)
- UI components and pages
- tRPC API for CRUD operations
- User settings and preferences
- Analytics dashboards
```

### Node.js Backend Responsibilities
```typescript
// Node.js handles:
- WebSocket connections (Socket.IO)
- LLM streaming (Anthropic, OpenAI)
- Real-time chat messaging
- File uploads and processing
- Tool execution
- Context management
```

### Authentication Bridge
The two systems communicate via **session-based authentication** using better-auth:

```typescript
// Next.js: Users authenticate via better-auth UI
// Session cookies are automatically managed

// Node.js: Validates sessions via better-auth API
const session = await auth.api.getSession({
  headers: req.headers
});

if (session?.user) {
  // User is authenticated
  req.user = session.user;
  req.session = session.session;
}
```

## 🗄️ Database Schema Synchronization

### The Challenge
Both systems need access to the same database schemas but in different locations:
- `@bestchatapp/src/db/schema/` (Next.js)
- `@bestchatapp/backend/src/db/schema/` (Node.js)

### Current Approach: Manual Synchronization
When schemas change, they must be updated in both locations:

```bash
# Manual process (current)
1. Update schema in src/db/schema/
2. Copy changes to backend/src/db/schema/
3. Run migrations from both locations
```

### Planned Solution: Automated Sync Scripts
```json
{
  "scripts": {
    "sync:schema-to-backend": "cp -r src/db/schema/* backend/src/db/schema/",
    "sync:schema-from-backend": "cp -r backend/src/db/schema/* src/db/schema/",
    "verify:schema-sync": "diff -r src/db/schema backend/src/db/schema"
  }
}
```

## 🔄 Communication Flow

### User Registration/Authentication
1. User registers/signs in **exclusively** via Next.js UI  
2. better-auth handles all authentication flows (signup, signin, password reset)
3. Polar manages billing/subscriptions
4. Session cookies automatically manage backend access

### Chat Message Flow
1. User types message in Next.js UI
2. WebSocket connection to Node.js backend
3. Session cookies validate user authentication via better-auth
4. Backend streams LLM response
5. Real-time updates via WebSocket
6. Database persistence in shared PostgreSQL
7. Next.js UI updates via tRPC invalidation

### Provider Configuration
1. User configures LLM providers in Next.js UI
2. tRPC saves to shared database
3. Node.js backend reads from same database
4. Streaming uses updated provider config

## 🚀 Deployment Strategy

### Development Environment
```bash
# Terminal 1: Next.js frontend
npm run dev

# Terminal 2: Node.js backend
cd backend && npm run dev

# Both connect to same PostgreSQL database
```

### Production Deployment
- **Frontend**: Deploy Next.js to Vercel/Netlify
- **Backend**: Deploy Node.js to Railway/Render/DigitalOcean
- **Database**: Shared PostgreSQL instance (Neon/Supabase)

## 🎯 Benefits

### Technical Benefits
- **WebSocket Support**: Native real-time communication
- **Streaming Responses**: Proper LLM streaming without Next.js limitations  
- **Session Authentication**: Secure better-auth session management with automatic cookie handling
- **Clean Separation**: Frontend handles auth UI, backend validates sessions only
- **Type Safety**: Shared TypeScript types across both systems
- **Scalability**: Independent scaling of UI and backend services

### Development Benefits
- **Specialization**: Each system handles what it does best
- **Team Workflow**: Frontend and backend teams can work independently
- **Technology Choice**: Use optimal tech stack for each concern
- **Future Flexibility**: Easy to migrate parts without affecting the whole

## ⚠️ Trade-offs

### Complexity
- **Two Codebases**: Need to maintain frontend and backend separately
- **Deployment**: Two deployment targets instead of one
- **Schema Sync**: Manual synchronization required (for now)

### Development Overhead
- **Local Setup**: Need to run both services in development
- **Testing**: Integration testing across two systems
- **Debugging**: Distributed system debugging complexity

## 🔮 Future Considerations

### Schema Sharing Evolution
```typescript
// Option 1: Shared Package (future)
// @bestchatapp/shared-schema
export * from './schemas';

// Option 2: Monorepo Structure
// packages/schema/
// packages/frontend/
// packages/backend/
```

### Service Mesh (Long-term)
As the system grows, consider:
- Service discovery
- Load balancing
- Circuit breakers
- Distributed tracing

## 📚 References

This hybrid architecture draws inspiration from:
- **Cline's Architecture**: Tool execution and context management patterns
- **Modern Web Apps**: Next.js best practices for UI and authentication
- **Real-time Systems**: Node.js patterns for WebSocket and streaming
- **Enterprise Architecture**: Microservices communication patterns

The hybrid approach provides a solid foundation that combines the UI/auth strengths of Next.js with the real-time capabilities of Node.js, creating a best-of-both-worlds solution for sophisticated AI chat applications.