# Development Workflow - Hybrid Architecture

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL database
- Git

### Initial Setup
```bash
# Clone and install dependencies
git clone <repository>
cd bestchatapp
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Setup environment variables
cp env.example .env.local
# Edit .env.local with your database credentials

# Setup backend environment
cp backend/env.example backend/.env
# Edit backend/.env with your database credentials
```

## 🔧 Development Environment

### Running the Full Stack
```bash
# Option 1: Run both frontend and backend simultaneously
npm run dev:full

# Option 2: Run separately (in different terminals)
# Terminal 1: Frontend (Next.js)
npm run dev

# Terminal 2: Backend (Node.js)
cd backend && npm run dev
```

### Development URLs
- **Frontend**: http://localhost:3000 (Next.js)
- **Backend**: http://localhost:8000 (Express)
- **Database Studio**: `npm run db:studio`

## 🗄️ Database Schema Management

### The Challenge
Our hybrid architecture requires identical schemas in two locations:
- `src/db/schema/` (Next.js frontend)
- `backend/src/db/schema/` (Node.js backend)

### Schema Synchronization Commands

```bash
# Validate schemas are synchronized
npm run verify:schema-sync

# Copy schemas from frontend to backend
npm run sync:schema-to-backend

# Copy schemas from backend to frontend  
npm run sync:schema-from-backend
```

### Making Schema Changes

#### Option 1: Frontend-First Approach (Recommended)
1. **Update schemas** in `src/db/schema/`
2. **Test locally** with Next.js app
3. **Sync to backend**: `npm run sync:schema-to-backend`
4. **Validate sync**: `npm run verify:schema-sync`
5. **Generate migrations**: `npm run db:generate`
6. **Apply migrations**: `npm run db:push`

#### Option 2: Backend-First Approach
1. **Update schemas** in `backend/src/db/schema/`
2. **Test locally** with Node.js backend
3. **Sync to frontend**: `npm run sync:schema-from-backend`
4. **Validate sync**: `npm run verify:schema-sync`
5. **Generate migrations**: `npm run db:generate`
6. **Apply migrations**: `npm run db:push`

### Pre-commit Workflow
```bash
# Before committing schema changes
npm run verify:schema-sync  # Ensure schemas are in sync
npm run db:generate        # Generate new migrations if needed
git add .                  # Stage all changes including synced schemas
git commit -m "feat: update chat schema with new fields"
```

## 🧪 Testing

### Frontend Testing (Next.js)
```bash
# Run frontend tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Backend Testing (Node.js)
```bash
# Run backend tests
cd backend && npm run test

# Run with coverage
cd backend && npm run test:coverage

# Watch mode
cd backend && npm run test:watch
```

### Integration Testing
```bash
# Ensure both services are running
npm run dev:full

# Run integration tests (when available)
npm run test:integration
```

## 🔄 API Development

### Adding New tRPC Routes (Frontend)
1. **Define route** in `src/trpc/routers/`
2. **Add types** if needed in `src/lib/types.ts`
3. **Write tests** in `src/__tests__/`
4. **Update documentation**

### Adding New REST Endpoints (Backend)
1. **Define route** in `backend/src/routes/`
2. **Add middleware** if needed
3. **Write tests** in `backend/src/__tests__/`
4. **Update API documentation**

### WebSocket Events (Backend)
1. **Define events** in `backend/src/websocket/`
2. **Add event handlers**
3. **Test real-time functionality**
4. **Update frontend WebSocket client**

## 🔐 Authentication Development

### Adding New Auth Features
1. **Update better-auth config** in `src/lib/auth.ts`
2. **Add new auth routes** if needed
3. **Update JWT token handling** in backend
4. **Test auth flow** between frontend and backend

### Polar Billing Integration
1. **Update billing logic** in `src/lib/polar/`
2. **Add new webhook handlers** if needed
3. **Test subscription flows**
4. **Update billing UI components**

## 📦 Building and Deployment

### Frontend Build (Next.js)
```bash
npm run build        # Build Next.js app
npm run start        # Start production server
```

### Backend Build (Node.js)
```bash
cd backend
npm run build        # Compile TypeScript
npm run start        # Start production server
```

### Environment-Specific Builds
```bash
# Development
NODE_ENV=development npm run build

# Production
NODE_ENV=production npm run build
```

## 🐛 Debugging

### Frontend Debugging
- **Next.js Dev Tools**: Built into development server
- **React DevTools**: Browser extension
- **tRPC DevTools**: `@tanstack/react-query-devtools`

### Backend Debugging
- **Node.js Inspector**: `node --inspect backend/dist/index.js`
- **WebSocket Debugging**: Use browser dev tools or Postman
- **Database Queries**: Enable Drizzle logging

### Cross-System Debugging
1. **Check JWT tokens**: Verify authentication bridge
2. **Monitor WebSocket**: Check real-time communication
3. **Database consistency**: Ensure schemas are synced
4. **CORS issues**: Verify cross-origin configuration

## 🚨 Common Issues

### Schema Synchronization Issues
```bash
# Problem: Schemas out of sync
# Solution: 
npm run verify:schema-sync  # Check status
npm run sync:schema-to-backend  # Fix sync

# Problem: Migration errors
# Solution:
npm run db:generate  # Regenerate migrations
npm run db:push     # Apply to database
```

### Port Conflicts
```bash
# Problem: Port already in use
# Solution: Change ports in package.json or kill processes
lsof -ti:3000 | xargs kill  # Kill process on port 3000
lsof -ti:8000 | xargs kill  # Kill process on port 8000
```

### WebSocket Connection Issues
1. **Check backend is running**: `curl http://localhost:8000/api/health`
2. **Verify CORS settings**: Check `backend/src/index.ts`
3. **Check JWT tokens**: Verify authentication flow

## 📋 Code Quality

### Linting and Formatting
```bash
# Frontend
npm run lint         # ESLint
npm run lint:fix     # Auto-fix issues

# Backend  
cd backend
npm run lint         # ESLint
npm run lint:fix     # Auto-fix issues
```

### Type Checking
```bash
# Frontend
npm run typecheck    # TypeScript check

# Backend
cd backend
npm run typecheck    # TypeScript check
```

### Pre-commit Hooks
The project uses Husky for pre-commit hooks:
- **Schema validation**: Ensures schemas are synchronized
- **Linting**: Runs ESLint on changed files
- **Type checking**: Validates TypeScript types
- **Tests**: Runs relevant tests

## 🎯 Best Practices

### Schema Management
- ✅ Always run `npm run verify:schema-sync` before committing
- ✅ Update schemas in one location first, then sync
- ✅ Test schema changes in both frontend and backend
- ❌ Never manually edit schemas in both locations simultaneously

### Development Flow
- ✅ Use `npm run dev:full` for full-stack development
- ✅ Test authentication flow between frontend and backend
- ✅ Validate WebSocket connections work properly
- ✅ Use TypeScript strictly (no `any` types per CLAUDE.md)

### Git Workflow
- ✅ Create feature branches for new functionality
- ✅ Include both frontend and backend changes in single PRs
- ✅ Run all tests before committing
- ✅ Update documentation with significant changes

## 📚 Additional Resources

- [Hybrid Architecture Guide](./architecture/hybrid-architecture.md)
- [Database Schema Documentation](./architecture/database-schema.md)
- [API Reference](./api/README.md)
- [Deployment Guide](./guides/deployment.md)