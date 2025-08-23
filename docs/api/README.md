# Chat API Documentation

## 🎯 Overview

This document provides comprehensive documentation for the BestChatApp tRPC API endpoints implemented in Sprint 01. The API provides foundational chat functionality including conversation management, provider configuration, and usage analytics.

## 📋 Table of Contents

1. [Chat Router](#chat-router)
2. [Providers Router](#providers-router)
3. [Usage Router](#usage-router)
4. [Authentication](#authentication)
5. [Error Handling](#error-handling)
6. [Type Definitions](#type-definitions)

---

## Chat Router

The chat router provides CRUD operations for conversations and messages.

### Endpoints

#### `chat.createConversation`

Creates a new chat conversation.

**Input:**
```typescript
{
  title?: string;           // Optional conversation title
  provider: string;         // LLM provider (e.g., 'anthropic', 'openai')
  model: string;           // Model ID (e.g., 'claude-3-5-sonnet-20241022')
  systemPrompt?: string;   // Optional system prompt
  contextWindowSize?: number; // Optional context window (default: 8192)
}
```

**Output:**
```typescript
{
  id: string;
  userId: string;
  title: string;
  provider: string;
  model: string;
  systemPrompt: string | null;
  contextWindowSize: number;
  autoApprovalSettings: object;
  metadata: object;
  createdAt: Date;
  updatedAt: Date;
}
```

**Example:**
```typescript
const conversation = await trpc.chat.createConversation.mutate({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  title: 'My Chat Session',
  systemPrompt: 'You are a helpful assistant.'
});
```

#### `chat.getConversations`

Retrieves user's conversations with pagination.

**Input:**
```typescript
{
  limit?: number;  // Maximum results (1-100, default: 20)
  offset?: number; // Skip N results (default: 0)
}
```

**Output:**
```typescript
Array<{
  id: string;
  userId: string;
  title: string;
  provider: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
  // ... other conversation fields
}>
```

**Example:**
```typescript
const conversations = await trpc.chat.getConversations.query({
  limit: 10,
  offset: 0
});
```

#### `chat.getConversation`

Retrieves a single conversation with its messages.

**Input:**
```typescript
{
  id: string;               // Conversation UUID
  includeMessages?: boolean; // Include messages (default: true)
  limit?: number;           // Message limit (default: 50)
  offset?: number;          // Message offset (default: 0)
}
```

**Output:**
```typescript
{
  id: string;
  userId: string;
  title: string;
  provider: string;
  model: string;
  messages: Array<{
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    images: string[];
    files: string[];
    tokenCount: number | null;
    createdAt: Date;
  }>;
  // ... other conversation fields
}
```

#### `chat.sendMessage`

Sends a message to a conversation.

**Input:**
```typescript
{
  conversationId: string;  // Conversation UUID
  content: string;         // Message content
  images?: string[];       // Optional image URLs
  files?: string[];        // Optional file references
}
```

**Output:**
```typescript
{
  id: string;
  conversationId: string;
  role: 'user';
  content: string;
  images: string[];
  files: string[];
  tokenCount: number | null;
  providerMetadata: object;
  createdAt: Date;
}
```

#### `chat.updateConversation`

Updates conversation metadata.

**Input:**
```typescript
{
  id: string;                      // Conversation UUID
  title?: string;                  // New title
  systemPrompt?: string;           // New system prompt
  autoApprovalSettings?: object;   // Auto-approval settings
}
```

#### `chat.deleteConversation`

Deletes a conversation and all associated messages.

**Input:**
```typescript
{
  id: string; // Conversation UUID
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

#### `chat.getConversationStats`

Gets statistics for a conversation.

**Input:**
```typescript
{
  id: string; // Conversation UUID
}
```

**Output:**
```typescript
{
  messageCount: number;
  totalTokens: number;
  provider: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `chat.deleteMessage`

Deletes a specific message from a conversation.

**Input:**
```typescript
{
  messageId: string;       // Message UUID
  conversationId: string;  // Conversation UUID
}
```

---

## Providers Router

Manages LLM provider configurations and supported providers.

### Endpoints

#### `providers.getSupportedProviders`

Returns all supported providers and their models.

**Output:**
```typescript
{
  [providerId: string]: {
    id: string;
    name: string;
    description: string;
    requiresApiKey: boolean;
    configFields: Array<{
      key: string;
      label: string;
      type: 'text' | 'password';
      required: boolean;
      placeholder?: string;
    }>;
    models: Array<{
      id: string;
      name: string;
      maxTokens: number;
      contextWindow: number;
    }>;
  };
}
```

**Example:**
```typescript
const providers = await trpc.providers.getSupportedProviders.query();
console.log(providers.anthropic.models); // Array of Claude models
```

#### `providers.getProviderConfigs`

Gets user's provider configurations (without sensitive data).

**Output:**
```typescript
Array<{
  id: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  hasConfig: boolean;
  createdAt: Date;
  updatedAt: Date;
}>
```

#### `providers.saveProviderConfig`

Saves or updates a provider configuration.

**Input:**
```typescript
{
  provider: string;     // Provider ID
  config: object;       // Configuration object (API keys, etc.)
  isDefault?: boolean;  // Set as default provider
}
```

**Example:**
```typescript
await trpc.providers.saveProviderConfig.mutate({
  provider: 'anthropic',
  config: {
    apiKey: 'sk-ant-your-api-key',
    baseUrl: 'https://api.anthropic.com'
  },
  isDefault: true
});
```

#### `providers.testProviderConfig`

Validates a provider configuration.

**Input:**
```typescript
{
  provider: string;  // Provider ID
  config: object;    // Configuration to test
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  provider: string;
}
```

#### `providers.deleteProviderConfig`

Deletes a provider configuration.

**Input:**
```typescript
{
  provider: string; // Provider ID
}
```

#### `providers.setDefaultProvider`

Sets a provider as the default.

**Input:**
```typescript
{
  provider: string; // Provider ID
}
```

#### `providers.getDefaultProvider`

Gets the user's default provider.

**Output:**
```typescript
{
  provider: string;
  isActive: boolean;
  createdAt: Date;
} | null
```

#### `providers.getProviderModels`

Gets available models for a specific provider.

**Input:**
```typescript
{
  provider: string; // Provider ID
}
```

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  maxTokens: number;
  contextWindow: number;
}>
```

---

## Usage Router

Provides usage tracking and analytics functionality.

### Endpoints

#### `usage.getUserUsage`

Gets user usage statistics with flexible filtering and grouping.

**Input:**
```typescript
{
  startDate?: Date;     // Filter start date
  endDate?: Date;       // Filter end date
  provider?: string;    // Filter by provider
  model?: string;       // Filter by model
  groupBy?: 'day' | 'week' | 'month' | 'provider' | 'model'; // Group results
}
```

**Output:**
```typescript
Array<{
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestCount: number;
  provider: string;
  model: string;
  date: string;
}>
```

#### `usage.getRecentUsage`

Gets recent usage logs with pagination.

**Input:**
```typescript
{
  limit?: number;          // Results limit (default: 20)
  offset?: number;         // Results offset (default: 0)
  provider?: string;       // Filter by provider
  conversationId?: string; // Filter by conversation
}
```

#### `usage.getUsageStats`

Gets usage statistics for different time periods.

**Input:**
```typescript
{
  period?: 'today' | 'week' | 'month' | 'year'; // Time period
  provider?: string;                             // Filter by provider
}
```

**Output:**
```typescript
{
  period: string;
  startDate: Date;
  endDate: Date;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestCount: number;
}
```

#### `usage.logUsage`

Logs usage for a conversation (internal use).

**Input:**
```typescript
{
  conversationId: string;  // Conversation UUID
  provider: string;        // Provider used
  model: string;          // Model used
  inputTokens: number;    // Input token count
  outputTokens: number;   // Output token count
  cost?: number;          // Optional cost
}
```

#### `usage.getProviderUsageSummary`

Gets usage summary grouped by provider.

**Input:**
```typescript
{
  days?: number; // Number of days to analyze (default: 30)
}
```

#### `usage.getTopModels`

Gets most used models.

**Input:**
```typescript
{
  limit?: number; // Number of results (default: 10)
  days?: number;  // Time period in days (default: 30)
}
```

#### `usage.getDailyUsageTrend`

Gets daily usage trends.

**Input:**
```typescript
{
  days?: number;      // Number of days (default: 30)
  provider?: string;  // Filter by provider
}
```

#### `usage.getCostBreakdown`

Gets detailed cost breakdown.

**Input:**
```typescript
{
  period?: 'week' | 'month' | 'year'; // Time period
}
```

**Output:**
```typescript
{
  period: string;
  startDate: Date;
  endDate: Date;
  totalCost: number;
  breakdown: Array<{
    provider: string;
    model: string;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    percentage: number;
  }>;
}
```

---

## Authentication

### Hybrid Authentication Architecture

BestChatApp uses a **hybrid authentication system** where:

- **Frontend (Next.js)** handles user signup and signin via better-auth
- **Backend (Node.js)** only validates existing sessions for API protection
- **Shared Database** stores user accounts and sessions

### Frontend Authentication (Next.js)
All user authentication flows (signup, signin, password reset) are handled by the Next.js frontend using better-auth. Users authenticate through the web interface.

### Backend Session Validation (Node.js)

The backend provides these session validation endpoints:

#### `GET /api/v1/auth/me`
Validates current session and returns user information.

**Response:**
```typescript
{
  success: true;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
  };
}
```

#### `POST /api/v1/auth/signout`
Invalidates the current session.

**Response:**
```typescript
{
  success: true;
  message: "Signed out successfully";
}
```

#### `/api/v1/auth/session/*`
Better-auth session handler mount point for browser-based authentication management.

### tRPC API Authentication

All tRPC endpoints require authentication. The user context is automatically injected:

```typescript
interface AuthContext {
  user: {
    id: string;
    email: string;
  };
}
```

**Protected Procedures:** All chat, providers, and usage endpoints use `protectedProcedure` which ensures the user is authenticated via session validation.

---

## Error Handling

The API uses standardized tRPC error codes:

### Common Error Codes

- `UNAUTHORIZED` - User not authenticated
- `NOT_FOUND` - Resource not found (conversation, provider config, etc.)
- `BAD_REQUEST` - Invalid input or validation error
- `INTERNAL_SERVER_ERROR` - Server error

### Error Response Format

```typescript
{
  error: {
    message: string;
    code: string;
    data?: {
      zodError?: ZodError; // Validation errors
    };
  };
}
```

### Example Error Handling

```typescript
try {
  const conversation = await trpc.chat.getConversation.query({
    id: 'invalid-id'
  });
} catch (error) {
  if (error.data?.code === 'NOT_FOUND') {
    console.log('Conversation not found');
  }
}
```

---

## Type Definitions

### Key Types

```typescript
// From src/lib/chat/types.ts
export type Conversation = RouterOutputs['chat']['getConversation']
export type Message = RouterOutputs['chat']['getConversation']['messages'][0]
export type ProviderConfig = RouterOutputs['providers']['getProviderConfigs'][0]
export type UsageLog = RouterOutputs['usage']['getRecentUsage'][0]

// Input types
export type CreateConversationInput = RouterInputs['chat']['createConversation']
export type SendMessageInput = RouterInputs['chat']['sendMessage']
export type SaveProviderConfigInput = RouterInputs['providers']['saveProviderConfig']
```

### Supported Providers

- **Anthropic**: Claude models with 200K context windows
- **OpenAI**: GPT models with various capabilities
- **Google**: Gemini models with large context windows
- **OpenRouter**: Multi-provider access
- **Ollama**: Local model support

---

## Usage Examples

### Complete Chat Flow

```typescript
// 1. Create conversation
const conversation = await trpc.chat.createConversation.mutate({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  title: 'Help with coding'
});

// 2. Send message
const message = await trpc.chat.sendMessage.mutate({
  conversationId: conversation.id,
  content: 'Help me write a React component'
});

// 3. Get conversation with messages
const fullConversation = await trpc.chat.getConversation.query({
  id: conversation.id
});

// 4. Track usage
await trpc.usage.logUsage.mutate({
  conversationId: conversation.id,
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  inputTokens: 150,
  outputTokens: 300,
  cost: 0.05
});
```

### Provider Configuration

```typescript
// 1. Get supported providers
const providers = await trpc.providers.getSupportedProviders.query();

// 2. Save configuration
await trpc.providers.saveProviderConfig.mutate({
  provider: 'anthropic',
  config: { apiKey: 'sk-ant-...' },
  isDefault: true
});

// 3. Test configuration
const test = await trpc.providers.testProviderConfig.mutate({
  provider: 'anthropic',
  config: { apiKey: 'sk-ant-...' }
});
```

### Usage Analytics

```typescript
// Get usage for last 30 days
const usage = await trpc.usage.getUserUsage.query({
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  groupBy: 'provider'
});

// Get cost breakdown
const costs = await trpc.usage.getCostBreakdown.query({
  period: 'month'
});
```

---

## Next Steps

Sprint 01 provides the foundational API layer. Future sprints will add:

- **Sprint 02**: Anthropic provider integration with streaming
- **Sprint 03**: Real-time chat UI components
- **Sprint 04**: Server-sent events for live updates
- **Sprint 05**: Additional provider integrations

This API layer is designed to be extensible and will support all advanced chat features planned for future development.