import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  decimal,
  index,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

// Conversations table - inspired by Cline's conversation management
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }),
    provider: varchar('provider', { length: 50 }).notNull(), // anthropic, openai, etc.
    model: varchar('model', { length: 100 }).notNull(),
    systemPrompt: text('system_prompt'),
    contextWindowSize: integer('context_window_size').default(8192),
    autoApprovalSettings: jsonb('auto_approval_settings').default('{}'),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_conversations_user_id').on(table.userId),
    createdAtIdx: index('idx_conversations_created_at').on(table.createdAt),
  })
)

// Messages table with rich content support
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // user, assistant, system
    content: text('content').notNull(),
    images: jsonb('images').default('[]'), // Array of image URLs/data
    files: jsonb('files').default('[]'), // Array of file references
    tokenCount: integer('token_count'),
    providerMetadata: jsonb('provider_metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index('idx_messages_conversation_id').on(
      table.conversationId
    ),
    createdAtIdx: index('idx_messages_created_at').on(table.createdAt),
    conversationCreatedIdx: index('idx_messages_conversation_created').on(
      table.conversationId,
      table.createdAt
    ),
  })
)

// Tool executions with detailed tracking - based on Cline's ToolExecutor patterns
export const toolExecutions = pgTable(
  'tool_executions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    toolName: varchar('tool_name', { length: 100 }).notNull(),
    parameters: jsonb('parameters').notNull(),
    result: jsonb('result'),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, approved, executing, completed, failed, cancelled
    approvalRequestedAt: timestamp('approval_requested_at'),
    approvedAt: timestamp('approved_at'),
    executedAt: timestamp('executed_at'),
    completedAt: timestamp('completed_at'),
    executionTimeMs: integer('execution_time_ms'),
    cost: decimal('cost', { precision: 10, scale: 4 }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index('idx_tool_executions_conversation_id').on(
      table.conversationId
    ),
    statusIdx: index('idx_tool_executions_status').on(table.status),
    toolNameIdx: index('idx_tool_executions_tool_name').on(table.toolName),
    statusCreatedIdx: index('idx_tool_executions_status_created').on(
      table.status,
      table.createdAt
    ),
  })
)

// Context optimizations tracking - inspired by Cline's ContextManager
export const contextOptimizations = pgTable(
  'context_optimizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    triggerReason: varchar('trigger_reason', { length: 50 }).notNull(), // token_limit, user_request, auto
    optimizationType: varchar('optimization_type', { length: 50 }).notNull(), // truncation, summarization, compression
    tokensBefore: integer('tokens_before').notNull(),
    tokensAfter: integer('tokens_after').notNull(),
    summary: text('summary'),
    affectedMessages: jsonb('affected_messages'), // Array of message IDs
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index('idx_context_optimizations_conversation_id').on(
      table.conversationId
    ),
    createdAtIdx: index('idx_context_optimizations_created_at').on(
      table.createdAt
    ),
  })
)

// File uploads and references
export const fileUploads = pgTable(
  'file_uploads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    filename: varchar('filename', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSize: integer('file_size').notNull(),
    storagePath: varchar('storage_path', { length: 500 }).notNull(),
    contentHash: varchar('content_hash', { length: 64 }),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_file_uploads_user_id').on(table.userId),
    conversationIdIdx: index('idx_file_uploads_conversation_id').on(
      table.conversationId
    ),
    contentHashIdx: index('idx_file_uploads_content_hash').on(
      table.contentHash
    ),
  })
)
