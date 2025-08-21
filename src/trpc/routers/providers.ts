// Reference: @cline/src/core/api/index.ts:344-355 & @chat_impl_Plan.md:988-1047
import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { db } from '@/db'
import { providerConfigs } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

// Provider configuration schemas
const providerConfigSchema = z.object({
  provider: z.string().min(1).max(50),
  config: z.record(z.any()), // Encrypted API keys, settings
  isDefault: z.boolean().default(false),
})

const updateProviderConfigSchema = z.object({
  provider: z.string().min(1).max(50),
  config: z.record(z.any()),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

const testProviderConfigSchema = z.object({
  provider: z.string(),
  config: z.record(z.any()),
})

// Supported providers list - inspired by Cline's provider registry
const SUPPORTED_PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models from Anthropic',
    requiresApiKey: true,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        required: false,
        placeholder: 'https://api.anthropic.com',
      },
    ],
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        maxTokens: 8192,
        contextWindow: 200000,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        maxTokens: 8192,
        contextWindow: 200000,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        maxTokens: 4096,
        contextWindow: 200000,
      },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models from OpenAI',
    requiresApiKey: true,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      {
        key: 'organization',
        label: 'Organization ID',
        type: 'text',
        required: false,
      },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        required: false,
        placeholder: 'https://api.openai.com/v1',
      },
    ],
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 4096, contextWindow: 128000 },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        maxTokens: 16384,
        contextWindow: 128000,
      },
      { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192, contextWindow: 8192 },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        maxTokens: 4096,
        contextWindow: 16384,
      },
    ],
  },
  google: {
    id: 'google',
    name: 'Google',
    description: 'Gemini models from Google',
    requiresApiKey: true,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        required: false,
        placeholder: 'https://generativelanguage.googleapis.com',
      },
    ],
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        maxTokens: 8192,
        contextWindow: 2000000,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        maxTokens: 8192,
        contextWindow: 1000000,
      },
    ],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access multiple models through OpenRouter',
    requiresApiKey: true,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'siteName', label: 'Site Name', type: 'text', required: false },
      { key: 'siteUrl', label: 'Site URL', type: 'text', required: false },
    ],
    models: [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet (OpenRouter)',
        maxTokens: 8192,
        contextWindow: 200000,
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o (OpenRouter)',
        maxTokens: 4096,
        contextWindow: 128000,
      },
      {
        id: 'meta-llama/llama-3.1-405b-instruct',
        name: 'Llama 3.1 405B',
        maxTokens: 4096,
        contextWindow: 131072,
      },
    ],
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local models via Ollama',
    requiresApiKey: false,
    configFields: [
      {
        key: 'baseUrl',
        label: 'Ollama URL',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:11434',
      },
    ],
    models: [
      {
        id: 'llama3.2',
        name: 'Llama 3.2',
        maxTokens: 2048,
        contextWindow: 128000,
      },
      {
        id: 'mistral',
        name: 'Mistral 7B',
        maxTokens: 4096,
        contextWindow: 32768,
      },
      {
        id: 'codellama',
        name: 'Code Llama',
        maxTokens: 4096,
        contextWindow: 16384,
      },
    ],
  },
} as const

export const providersRouter = createTRPCRouter({
  // Get supported providers and models
  getSupportedProviders: protectedProcedure.query(async () => {
    return SUPPORTED_PROVIDERS
  }),

  // Get user's provider configurations
  getProviderConfigs: protectedProcedure.query(async ({ ctx }) => {
    const configs = await db
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.userId, ctx.user.id))

    // Don't return sensitive config data, just provider info
    return configs.map((config) => ({
      id: config.id,
      provider: config.provider,
      isActive: config.isActive,
      isDefault: config.isDefault,
      hasConfig: Object.keys(config.config as object).length > 0,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }))
  }),

  // Get specific provider configuration (without sensitive data)
  getProviderConfig: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await db
        .select()
        .from(providerConfigs)
        .where(
          and(
            eq(providerConfigs.userId, ctx.user.id),
            eq(providerConfigs.provider, input.provider)
          )
        )
        .then((rows) => rows[0])

      if (!config) {
        return null
      }

      // Return config without sensitive fields
      const configData = config.config as Record<string, any>
      const sanitizedConfig = { ...configData }

      // Remove sensitive fields
      if (sanitizedConfig.apiKey) {
        sanitizedConfig.apiKey = '***'
      }

      return {
        id: config.id,
        provider: config.provider,
        config: sanitizedConfig,
        isActive: config.isActive,
        isDefault: config.isDefault,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      }
    }),

  // Save/update provider configuration
  saveProviderConfig: protectedProcedure
    .input(providerConfigSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: Encrypt sensitive config data before storing
      // For now, storing as-is for development

      // Validate provider exists
      if (!(input.provider in SUPPORTED_PROVIDERS)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unsupported provider: ${input.provider}`,
        })
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(providerConfigs)
          .set({ isDefault: false })
          .where(eq(providerConfigs.userId, ctx.user.id))
      }

      // Upsert provider config
      const existingConfig = await db
        .select()
        .from(providerConfigs)
        .where(
          and(
            eq(providerConfigs.userId, ctx.user.id),
            eq(providerConfigs.provider, input.provider)
          )
        )
        .then((rows) => rows[0])

      if (existingConfig) {
        // Update existing
        const updated = await db
          .update(providerConfigs)
          .set({
            config: input.config,
            isDefault: input.isDefault,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(providerConfigs.id, existingConfig.id))
          .returning()

        return updated[0]
      } else {
        // Create new
        const created = await db
          .insert(providerConfigs)
          .values({
            userId: ctx.user.id,
            provider: input.provider,
            config: input.config,
            isDefault: input.isDefault,
            isActive: true,
          })
          .returning()

        return created[0]
      }
    }),

  // Update provider configuration
  updateProviderConfig: protectedProcedure
    .input(updateProviderConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const existingConfig = await db
        .select()
        .from(providerConfigs)
        .where(
          and(
            eq(providerConfigs.userId, ctx.user.id),
            eq(providerConfigs.provider, input.provider)
          )
        )
        .then((rows) => rows[0])

      if (!existingConfig) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Provider configuration not found',
        })
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(providerConfigs)
          .set({ isDefault: false })
          .where(eq(providerConfigs.userId, ctx.user.id))
      }

      const updated = await db
        .update(providerConfigs)
        .set({
          config: input.config,
          isActive: input.isActive ?? existingConfig.isActive,
          isDefault: input.isDefault ?? existingConfig.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(providerConfigs.id, existingConfig.id))
        .returning()

      return updated[0]
    }),

  // Test provider configuration
  testProviderConfig: protectedProcedure
    .input(testProviderConfigSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: In Sprint 2, this will actually test the provider
      // For now, just validate required fields are present

      const provider =
        SUPPORTED_PROVIDERS[input.provider as keyof typeof SUPPORTED_PROVIDERS]

      if (!provider) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unsupported provider: ${input.provider}`,
        })
      }

      // Validate required config fields
      const requiredFields = provider.configFields.filter(
        (field) => field.required
      )
      const missingFields = requiredFields.filter(
        (field) => !input.config[field.key]
      )

      if (missingFields.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Missing required fields: ${missingFields.map((f) => f.label).join(', ')}`,
        })
      }

      // Provider-specific validation
      if (input.provider === 'anthropic') {
        if (
          !input.config.apiKey ||
          !input.config.apiKey.startsWith('sk-ant-')
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid Anthropic API key format',
          })
        }
      } else if (input.provider === 'openai') {
        if (!input.config.apiKey || !input.config.apiKey.startsWith('sk-')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid OpenAI API key format',
          })
        }
      } else if (input.provider === 'ollama') {
        if (!input.config.baseUrl) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ollama base URL is required',
          })
        }
      }

      return {
        success: true,
        message: 'Configuration validation passed',
        provider: input.provider,
      }
    }),

  // Delete provider configuration
  deleteProviderConfig: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await db
        .delete(providerConfigs)
        .where(
          and(
            eq(providerConfigs.userId, ctx.user.id),
            eq(providerConfigs.provider, input.provider)
          )
        )
        .returning()

      if (deleted.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Provider configuration not found',
        })
      }

      return { success: true }
    }),

  // Set default provider
  setDefaultProvider: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if provider config exists
      const existingConfig = await db
        .select()
        .from(providerConfigs)
        .where(
          and(
            eq(providerConfigs.userId, ctx.user.id),
            eq(providerConfigs.provider, input.provider)
          )
        )
        .then((rows) => rows[0])

      if (!existingConfig) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Provider configuration not found',
        })
      }

      // Unset all other defaults
      await db
        .update(providerConfigs)
        .set({ isDefault: false })
        .where(eq(providerConfigs.userId, ctx.user.id))

      // Set this provider as default
      const updated = await db
        .update(providerConfigs)
        .set({
          isDefault: true,
          updatedAt: new Date(),
        })
        .where(eq(providerConfigs.id, existingConfig.id))
        .returning()

      return updated[0]
    }),

  // Get default provider
  getDefaultProvider: protectedProcedure.query(async ({ ctx }) => {
    const defaultConfig = await db
      .select()
      .from(providerConfigs)
      .where(
        and(
          eq(providerConfigs.userId, ctx.user.id),
          eq(providerConfigs.isDefault, true),
          eq(providerConfigs.isActive, true)
        )
      )
      .then((rows) => rows[0])

    if (!defaultConfig) {
      return null
    }

    return {
      provider: defaultConfig.provider,
      isActive: defaultConfig.isActive,
      createdAt: defaultConfig.createdAt,
    }
  }),

  // Get available models for a provider
  getProviderModels: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ input }) => {
      const provider =
        SUPPORTED_PROVIDERS[input.provider as keyof typeof SUPPORTED_PROVIDERS]

      if (!provider) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Provider not found: ${input.provider}`,
        })
      }

      return provider.models
    }),
})
