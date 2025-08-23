'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/trpc/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MessageCircle, Send, Loader2, Tool, User, Bot } from 'lucide-react'

interface RealtimeChatProps {
  conversationId: string
  userId: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface TypingUser {
  userId: string
  userName: string
}

export function RealtimeChat({ conversationId, userId }: RealtimeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [streamingMessages, setStreamingMessages] = useState<
    Map<string, string>
  >(new Map())
  const [toolExecutions, setToolExecutions] = useState<
    Array<{
      executionId: string
      toolName: string
      status: string
    }>
  >([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Send message mutation
  const sendMessage = api.chat.sendMessage.useMutation({
    onSuccess: () => {
      setCurrentMessage('')
    },
  })

  // Send typing indicator mutation
  const sendTypingIndicator = api.chat.sendTypingIndicator.useMutation()

  // Subscribe to messages
  api.chat.subscribeToMessages.useSubscription(
    { conversationId },
    {
      onData: (data) => {
        if (data.type === 'newMessage' && data.message) {
          setMessages((prev) => [
            ...prev,
            {
              id: data.message!.id,
              role: data.message!.role as 'user' | 'assistant' | 'system',
              content: data.message!.content,
              timestamp: new Date(data.message!.createdAt),
            },
          ])
        }
        if (data.type === 'messageDeleted' && data.messageId) {
          setMessages((prev) => prev.filter((msg) => msg.id !== data.messageId))
        }
      },
      onError: (error) => {
        console.error('Message subscription error:', error)
      },
    }
  )

  // Subscribe to AI response streaming
  api.chat.subscribeToAIResponse.useSubscription(
    { conversationId },
    {
      onData: (data) => {
        if (data.type === 'streamStart') {
          // Add streaming message placeholder
          setMessages((prev) => [
            ...prev,
            {
              id: data.messageId!,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              isStreaming: true,
            },
          ])
        }
        if (data.type === 'streamChunk' || data.type === 'streamComplete') {
          // Update streaming message content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.messageId
                ? {
                    ...msg,
                    content: data.content || '',
                    isStreaming: data.type !== 'streamComplete',
                  }
                : msg
            )
          )
        }
      },
      onError: (error) => {
        console.error('AI streaming subscription error:', error)
      },
    }
  )

  // Subscribe to typing indicators
  api.chat.subscribeToTyping.useSubscription(
    { conversationId },
    {
      onData: (data) => {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            return [
              ...prev.filter((u) => u.userId !== data.userId),
              {
                userId: data.userId,
                userName: data.userName,
              },
            ]
          } else {
            return prev.filter((u) => u.userId !== data.userId)
          }
        })
      },
      onError: (error) => {
        console.error('Typing subscription error:', error)
      },
    }
  )

  // Subscribe to tool execution updates
  api.chat.subscribeToToolUpdates.useSubscription(
    { conversationId },
    {
      onData: (data) => {
        setToolExecutions((prev) => {
          const existing = prev.find((t) => t.executionId === data.executionId)
          if (existing) {
            return prev.map((t) =>
              t.executionId === data.executionId
                ? { ...t, status: data.status }
                : t
            )
          } else {
            return [
              ...prev,
              {
                executionId: data.executionId,
                toolName: data.toolName,
                status: data.status,
              },
            ]
          }
        })
      },
      onError: (error) => {
        console.error('Tool updates subscription error:', error)
      },
    }
  )

  // Handle typing
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true)
      sendTypingIndicator.mutate({
        conversationId,
        isTyping: true,
      })
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      sendTypingIndicator.mutate({
        conversationId,
        isTyping: false,
      })
    }, 1000)
  }

  // Handle send message
  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false)
      sendTypingIndicator.mutate({
        conversationId,
        isTyping: false,
      })
    }

    // Send message
    sendMessage.mutate({
      conversationId,
      content: currentMessage.trim(),
    })
  }

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4" />
      case 'assistant':
        return <Bot className="h-4 w-4" />
      default:
        return <MessageCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'executing':
        return 'bg-blue-100 text-blue-800'
      case 'approval_required':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Real-time Chat
        </CardTitle>
        {/* Tool Executions Status */}
        {toolExecutions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {toolExecutions.map((tool) => (
              <Badge
                key={tool.executionId}
                variant="outline"
                className={getStatusColor(tool.status)}
              >
                <Tool className="h-3 w-3 mr-1" />
                {tool.toolName}: {tool.status}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4 border rounded-lg bg-gray-50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`flex-shrink-0 p-2 rounded-full ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200'
                }`}
              >
                {getMessageIcon(message.role)}
              </div>

              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border'
                }`}
              >
                <div className="text-sm">
                  {message.content}
                  {message.isStreaming && (
                    <Loader2 className="h-3 w-3 animate-spin inline ml-1" />
                  )}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicators */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
              <span className="text-sm text-gray-600">
                {typingUsers.map((u) => u.userName).join(', ')}{' '}
                {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <Separator />

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={currentMessage}
            onChange={(e) => {
              setCurrentMessage(e.target.value)
              handleTyping()
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled={sendMessage.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!currentMessage.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Connection Status */}
        <div className="text-xs text-gray-500 text-center">
          {/* Show real-time connection status */}
          Real-time chat enabled • {messages.length} messages
        </div>
      </CardContent>
    </Card>
  )
}
