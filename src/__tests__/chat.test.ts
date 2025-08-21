import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { appRouter } from '@/trpc/routers/_app'
import { db } from '@/db'

// Mock the database
jest.mock('@/db', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

// Mock auth context
const mockContext = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
  session: {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
    },
  },
}

// Create a test caller
const createTestCaller = () => {
  return appRouter.createCaller(mockContext)
}

describe('Chat tRPC Routers', () => {
  let caller: ReturnType<typeof createTestCaller>

  beforeEach(() => {
    jest.clearAllMocks()
    caller = createTestCaller()
  })

  describe('Chat Router', () => {
    describe('createConversation', () => {
      it('should create a conversation successfully', async () => {
        const mockConversation = {
          id: 'test-conversation-id',
          userId: 'test-user-id',
          title: 'New Anthropic Chat',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          systemPrompt: null,
          contextWindowSize: 8192,
          autoApprovalSettings: {},
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        // Mock database response
        const mockInsert = jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockConversation]),
          }),
        })
        ;(db.insert as jest.Mock).mockReturnValue(mockInsert)

        const result = await caller.chat.createConversation({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          title: 'Test Chat',
        })

        expect(result).toEqual(mockConversation)
        expect(db.insert).toHaveBeenCalled()
      })

      it('should use default title when not provided', async () => {
        const mockConversation = {
          id: 'test-conversation-id',
          userId: 'test-user-id',
          title: 'New anthropic Chat',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          systemPrompt: null,
          contextWindowSize: 8192,
          autoApprovalSettings: {},
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const mockInsert = jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockConversation]),
          }),
        })
        ;(db.insert as jest.Mock).mockReturnValue(mockInsert)

        const result = await caller.chat.createConversation({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
        })

        expect(result.title).toBe('New anthropic Chat')
      })
    })

    describe('getConversations', () => {
      it('should return user conversations with pagination', async () => {
        const mockConversations = [
          {
            id: 'conv-1',
            userId: 'test-user-id',
            title: 'Chat 1',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'conv-2',
            userId: 'test-user-id',
            title: 'Chat 2',
            provider: 'openai',
            model: 'gpt-4o',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]

        const mockSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  offset: jest.fn().mockResolvedValue(mockConversations),
                }),
              }),
            }),
          }),
        })
        ;(db.select as jest.Mock).mockReturnValue(mockSelect)

        const result = await caller.chat.getConversations({
          limit: 10,
          offset: 0,
        })

        expect(result).toEqual(mockConversations)
        expect(result).toHaveLength(2)
      })
    })

    describe('sendMessage', () => {
      it('should send a message to existing conversation', async () => {
        const conversationId = 'test-conversation-id'
        const mockConversation = {
          id: conversationId,
          userId: 'test-user-id',
          title: 'Test Chat',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
        }

        const mockMessage = {
          id: 'test-message-id',
          conversationId: conversationId,
          role: 'user',
          content: 'Hello, world!',
          images: [],
          files: [],
          tokenCount: null,
          providerMetadata: {},
          createdAt: new Date(),
        }

        // Mock conversation lookup
        const mockConversationSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              then: jest.fn().mockResolvedValue([mockConversation]),
            }),
          }),
        })

        // Mock message insert
        const mockMessageInsert = jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockMessage]),
          }),
        })

        // Mock conversation update
        const mockUpdate = jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        })

        ;(db.select as jest.Mock).mockReturnValue(mockConversationSelect)
        ;(db.insert as jest.Mock).mockReturnValue(mockMessageInsert)
        ;(db.update as jest.Mock).mockReturnValue(mockUpdate)

        const result = await caller.chat.sendMessage({
          conversationId: conversationId,
          content: 'Hello, world!',
        })

        expect(result).toEqual(mockMessage)
      })

      it('should throw error for non-existent conversation', async () => {
        const mockSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              then: jest.fn().mockResolvedValue([]), // Empty array = no conversation found
            }),
          }),
        })
        ;(db.select as jest.Mock).mockReturnValue(mockSelect)

        await expect(
          caller.chat.sendMessage({
            conversationId: 'non-existent-id',
            content: 'Hello, world!',
          })
        ).rejects.toThrow('Conversation not found')
      })
    })

    describe('deleteConversation', () => {
      it('should delete conversation successfully', async () => {
        const conversationId = 'test-conversation-id'
        const mockConversation = {
          id: conversationId,
          userId: 'test-user-id',
          title: 'Test Chat',
        }

        const mockSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              then: jest.fn().mockResolvedValue([mockConversation]),
            }),
          }),
        })

        const mockDelete = jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        })

        ;(db.select as jest.Mock).mockReturnValue(mockSelect)
        ;(db.delete as jest.Mock).mockReturnValue(mockDelete)

        const result = await caller.chat.deleteConversation({
          id: conversationId,
        })

        expect(result).toEqual({ success: true })
      })
    })
  })

  describe('Providers Router', () => {
    describe('getSupportedProviders', () => {
      it('should return supported providers', async () => {
        const result = await caller.providers.getSupportedProviders()

        expect(result).toHaveProperty('anthropic')
        expect(result).toHaveProperty('openai')
        expect(result).toHaveProperty('google')
        expect(result.anthropic).toHaveProperty('models')
        expect(result.anthropic.models).toBeInstanceOf(Array)
      })
    })

    describe('saveProviderConfig', () => {
      it('should save provider configuration', async () => {
        const mockConfig = {
          id: 'test-config-id',
          userId: 'test-user-id',
          provider: 'anthropic',
          config: { apiKey: 'sk-ant-test-key' },
          isActive: true,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        // Mock checking for existing config (none found)
        const mockSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              then: jest.fn().mockResolvedValue([]), // No existing config
            }),
          }),
        })

        // Mock update for unsetting defaults
        const mockUpdate = jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        })

        // Mock insert for new config
        const mockInsert = jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockConfig]),
          }),
        })

        ;(db.select as jest.Mock).mockReturnValue(mockSelect)
        ;(db.update as jest.Mock).mockReturnValue(mockUpdate)
        ;(db.insert as jest.Mock).mockReturnValue(mockInsert)

        const result = await caller.providers.saveProviderConfig({
          provider: 'anthropic',
          config: { apiKey: 'sk-ant-test-key' },
          isDefault: false,
        })

        expect(result).toEqual(mockConfig)
      })

      it('should throw error for unsupported provider', async () => {
        await expect(
          caller.providers.saveProviderConfig({
            provider: 'unsupported-provider',
            config: { apiKey: 'test-key' },
            isDefault: false,
          })
        ).rejects.toThrow('Unsupported provider: unsupported-provider')
      })
    })

    describe('testProviderConfig', () => {
      it('should validate anthropic config successfully', async () => {
        const result = await caller.providers.testProviderConfig({
          provider: 'anthropic',
          config: { apiKey: 'sk-ant-test-key' },
        })

        expect(result).toEqual({
          success: true,
          message: 'Configuration validation passed',
          provider: 'anthropic',
        })
      })

      it('should throw error for invalid anthropic key', async () => {
        await expect(
          caller.providers.testProviderConfig({
            provider: 'anthropic',
            config: { apiKey: 'invalid-key' },
          })
        ).rejects.toThrow('Invalid Anthropic API key format')
      })

      it('should validate openai config successfully', async () => {
        const result = await caller.providers.testProviderConfig({
          provider: 'openai',
          config: { apiKey: 'sk-test-key' },
        })

        expect(result).toEqual({
          success: true,
          message: 'Configuration validation passed',
          provider: 'openai',
        })
      })
    })
  })

  describe('Usage Router', () => {
    describe('logUsage', () => {
      it('should log usage for valid conversation', async () => {
        const conversationId = 'test-conversation-id'
        const mockConversation = {
          id: conversationId,
          userId: 'test-user-id',
          title: 'Test Chat',
        }

        const mockUsage = {
          id: 'test-usage-id',
          userId: 'test-user-id',
          conversationId: conversationId,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.01,
          createdAt: new Date(),
        }

        // Mock conversation lookup
        const mockSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              then: jest.fn().mockResolvedValue([mockConversation]),
            }),
          }),
        })

        // Mock usage insert
        const mockInsert = jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockUsage]),
          }),
        })

        ;(db.select as jest.Mock).mockReturnValue(mockSelect)
        ;(db.insert as jest.Mock).mockReturnValue(mockInsert)

        const result = await caller.usage.logUsage({
          conversationId: conversationId,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.01,
        })

        expect(result).toEqual(mockUsage)
      })
    })

    describe('getUsageStats', () => {
      it('should return usage statistics for today', async () => {
        const mockStats = {
          totalTokens: 150,
          inputTokens: 100,
          outputTokens: 50,
          totalCost: 0.01,
          requestCount: 1,
        }

        const mockSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              then: jest.fn().mockResolvedValue([mockStats]),
            }),
          }),
        })
        ;(db.select as jest.Mock).mockReturnValue(mockSelect)

        const result = await caller.usage.getUsageStats({
          period: 'today',
        })

        expect(result).toHaveProperty('period', 'today')
        expect(result).toHaveProperty('totalTokens')
        expect(result).toHaveProperty('requestCount')
        expect(result).toHaveProperty('startDate')
        expect(result).toHaveProperty('endDate')
      })
    })
  })

  describe('Input Validation', () => {
    it('should validate conversation creation inputs', async () => {
      await expect(
        caller.chat.createConversation({
          provider: '', // Empty provider
          model: 'claude-3-5-sonnet-20241022',
        })
      ).rejects.toThrow()
    })

    it('should validate message sending inputs', async () => {
      await expect(
        caller.chat.sendMessage({
          conversationId: 'invalid-uuid', // Invalid UUID
          content: 'Hello',
        })
      ).rejects.toThrow()
    })

    it('should validate usage logging inputs', async () => {
      await expect(
        caller.usage.logUsage({
          conversationId: 'test-conversation-id',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: -1, // Negative tokens
          outputTokens: 50,
        })
      ).rejects.toThrow()
    })
  })
})
