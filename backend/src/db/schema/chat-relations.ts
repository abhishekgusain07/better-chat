// Reference existing relations pattern from bestchatapp/src/db/schema/relations.ts
import { relations } from 'drizzle-orm'
import { user } from './auth'
import {
  conversations,
  messages,
  toolExecutions,
  contextOptimizations,
  fileUploads,
  providerConfigs,
  usageLogs,
  autoApprovalSettings,
} from './chat'

// Conversation relations
export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(user, {
      fields: [conversations.userId],
      references: [user.id],
    }),
    messages: many(messages),
    toolExecutions: many(toolExecutions),
    contextOptimizations: many(contextOptimizations),
    fileUploads: many(fileUploads),
    usageLogs: many(usageLogs),
  })
)

// Message relations
export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  toolExecutions: many(toolExecutions),
}))

// Tool execution relations
export const toolExecutionsRelations = relations(toolExecutions, ({ one }) => ({
  message: one(messages, {
    fields: [toolExecutions.messageId],
    references: [messages.id],
  }),
  conversation: one(conversations, {
    fields: [toolExecutions.conversationId],
    references: [conversations.id],
  }),
}))

// Context optimization relations
export const contextOptimizationsRelations = relations(
  contextOptimizations,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [contextOptimizations.conversationId],
      references: [conversations.id],
    }),
  })
)

// File upload relations
export const fileUploadsRelations = relations(fileUploads, ({ one }) => ({
  user: one(user, {
    fields: [fileUploads.userId],
    references: [user.id],
  }),
  conversation: one(conversations, {
    fields: [fileUploads.conversationId],
    references: [conversations.id],
  }),
}))

// Provider config relations - relate to existing auth users
export const providerConfigsRelations = relations(
  providerConfigs,
  ({ one }) => ({
    user: one(user, {
      fields: [providerConfigs.userId],
      references: [user.id],
    }),
  })
)

// Usage logs relations
export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(user, {
    fields: [usageLogs.userId],
    references: [user.id],
  }),
  conversation: one(conversations, {
    fields: [usageLogs.conversationId],
    references: [conversations.id],
  }),
}))

// Auto approval settings relations
export const autoApprovalSettingsRelations = relations(
  autoApprovalSettings,
  ({ one }) => ({
    user: one(user, {
      fields: [autoApprovalSettings.userId],
      references: [user.id],
    }),
  })
)

// Extend existing user relations to include chat tables
export const userChatRelations = relations(user, ({ many }) => ({
  conversations: many(conversations),
  fileUploads: many(fileUploads),
  providerConfigs: many(providerConfigs),
  usageLogs: many(usageLogs),
  autoApprovalSettings: many(autoApprovalSettings),
}))
