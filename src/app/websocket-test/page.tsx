'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from '@/lib/auth-client'

interface TestMessage {
  id: string
  message: string
  timestamp: string
  userId?: string
  type: 'sent' | 'received' | 'system'
}

interface AuthInfo {
  authenticated: boolean
  user?: {
    id: string
    name: string
    email: string
  }
}

export default function WebSocketTestPage() {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [messages, setMessages] = useState<TestMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null)
  const [apiTest, setApiTest] = useState<{
    public: any
    protected: any
    authInfo: any
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const addMessage = (
    message: string,
    type: 'sent' | 'received' | 'system',
    userId?: string
  ) => {
    const newMessage: TestMessage = {
      id: Date.now().toString(),
      message,
      timestamp: new Date().toISOString(),
      userId,
      type,
    }
    setMessages((prev) => [...prev, newMessage])
  }

  const connectWebSocket = async () => {
    if (!session?.user) {
      addMessage('❌ Please sign in to test WebSocket connection', 'system')
      return
    }

    setConnecting(true)
    addMessage('🔌 Connecting to WebSocket server...', 'system')

    try {
      // Use backend port from environment or default to 3001
      const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || '3001'
      const backendUrl = `${window.location.protocol}//${window.location.hostname}:${backendPort}`

      const newSocket = io(backendUrl, {
        path: '/ws/',
        withCredentials: true,
        transports: ['websocket'],
      })

      // Connection events
      newSocket.on('connect', () => {
        setConnected(true)
        setConnecting(false)
        addMessage(
          `✅ Connected to WebSocket server (ID: ${newSocket.id})`,
          'system'
        )
      })

      newSocket.on('disconnect', (reason) => {
        setConnected(false)
        setConnecting(false)
        addMessage(
          `❌ Disconnected from WebSocket server (Reason: ${reason})`,
          'system'
        )
      })

      newSocket.on('connect_error', (error) => {
        setConnected(false)
        setConnecting(false)
        addMessage(`❌ Connection failed: ${error.message}`, 'system')
      })

      // Authentication events
      newSocket.on('authenticated', (data) => {
        addMessage(`🔐 Authenticated as ${data.name} (${data.email})`, 'system')
        setAuthInfo({
          authenticated: true,
          user: {
            id: data.userId,
            name: data.name,
            email: data.email,
          },
        })
      })

      // Test event responses
      newSocket.on('test_message_response', (data) => {
        addMessage(data.message, 'received', data.userId)
      })

      newSocket.on('test_auth_response', (data) => {
        const authStatus = data.authenticated
          ? '✅ Authenticated'
          : '❌ Not authenticated'
        const userInfo = data.user
          ? ` - User: ${data.user.name} (${data.user.email})`
          : ''
        addMessage(`${authStatus}${userInfo}`, 'system')
      })

      newSocket.on('test_pong', (data) => {
        addMessage(
          `🏓 Pong received at ${new Date(data.timestamp).toLocaleTimeString()}`,
          'system'
        )
      })

      // Error handling
      newSocket.on('error', (data) => {
        addMessage(`❌ Error: ${data.message}`, 'system')
      })

      setSocket(newSocket)
    } catch (error) {
      setConnecting(false)
      addMessage(`❌ Failed to connect: ${error}`, 'system')
    }
  }

  const disconnectWebSocket = () => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
      setConnected(false)
      setAuthInfo(null)
      addMessage('🔌 Manually disconnected from WebSocket server', 'system')
    }
  }

  const sendTestMessage = () => {
    if (!socket || !connected || !inputMessage.trim()) return

    socket.emit('test_message', { message: inputMessage })
    addMessage(inputMessage, 'sent')
    setInputMessage('')
  }

  const testAuth = () => {
    if (!socket || !connected) return
    socket.emit('test_auth')
    addMessage('🔐 Testing authentication...', 'system')
  }

  const testPing = () => {
    if (!socket || !connected) return
    socket.emit('test_ping')
    addMessage('🏓 Ping sent...', 'system')
  }

  const testApiEndpoints = async () => {
    try {
      // Test public endpoint
      const publicResponse = await fetch('/api/proxy/test/public')
      const publicData = await publicResponse.json()

      // Test protected endpoint
      const protectedResponse = await fetch('/api/proxy/test/protected', {
        credentials: 'include',
      })
      const protectedData = await protectedResponse.json()

      // Test auth info endpoint
      const authResponse = await fetch('/api/proxy/test/auth-info', {
        credentials: 'include',
      })
      const authData = await authResponse.json()

      setApiTest({
        public: publicData,
        protected: protectedData,
        authInfo: authData,
      })

      addMessage('📡 API endpoints tested - check results below', 'system')
    } catch (error) {
      addMessage(`❌ API test failed: ${error}`, 'system')
    }
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto bg-card rounded-lg border p-6">
          <h1 className="text-2xl font-bold mb-4">WebSocket Test</h1>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-muted-foreground">
              Please{' '}
              <a href="/sign-in" className="text-primary hover:underline">
                sign in
              </a>{' '}
              to test WebSocket functionality.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-card rounded-lg border p-6">
          <h1 className="text-3xl font-bold mb-2">WebSocket Test</h1>
          <p className="text-muted-foreground mb-4">
            Test WebSocket connection and authentication with the backend
            server.
          </p>

          {/* Connection Status */}
          <div className="bg-muted p-4 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Connection Status: </span>
                <span
                  className={
                    connected
                      ? 'text-green-600'
                      : connecting
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }
                >
                  {connected
                    ? '🟢 Connected'
                    : connecting
                      ? '🟡 Connecting...'
                      : '🔴 Disconnected'}
                </span>
              </div>
              <div className="space-x-2">
                <button
                  onClick={connectWebSocket}
                  disabled={connected || connecting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  Connect
                </button>
                <button
                  onClick={disconnectWebSocket}
                  disabled={!connected}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>

          {/* Test Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">WebSocket Tests</h3>
              <div className="space-y-2">
                <button
                  onClick={testAuth}
                  disabled={!connected}
                  className="w-full px-3 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50"
                >
                  🔐 Test Authentication
                </button>
                <button
                  onClick={testPing}
                  disabled={!connected}
                  className="w-full px-3 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50"
                >
                  🏓 Test Ping
                </button>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">API Tests</h3>
              <button
                onClick={testApiEndpoints}
                className="w-full px-3 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
              >
                📡 Test API Endpoints
              </button>
            </div>
          </div>

          {/* Message Input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendTestMessage()}
              placeholder="Type a test message..."
              disabled={!connected}
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <button
              onClick={sendTestMessage}
              disabled={!connected || !inputMessage.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              Send
            </button>
          </div>

          {/* Messages */}
          <div className="bg-muted p-4 rounded-lg h-96 overflow-y-auto">
            <h3 className="font-semibold mb-2">Messages</h3>
            <div className="space-y-2 text-sm">
              {messages.length === 0 ? (
                <p className="text-muted-foreground">No messages yet...</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded ${
                      msg.type === 'sent'
                        ? 'bg-primary text-primary-foreground ml-auto max-w-xs'
                        : msg.type === 'system'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-background border mr-auto max-w-xs'
                    }`}
                  >
                    <div className="font-medium">{msg.message}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Authentication Info */}
          {authInfo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <h3 className="font-semibold text-green-800 mb-2">
                WebSocket Authentication Info
              </h3>
              <pre className="text-sm text-green-700">
                {JSON.stringify(authInfo, null, 2)}
              </pre>
            </div>
          )}

          {/* API Test Results */}
          {apiTest && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h3 className="font-semibold text-blue-800 mb-2">
                API Test Results
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong className="text-blue-700">Public Endpoint:</strong>
                  <pre className="mt-1 text-blue-600 bg-blue-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(apiTest.public, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong className="text-blue-700">Protected Endpoint:</strong>
                  <pre className="mt-1 text-blue-600 bg-blue-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(apiTest.protected, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong className="text-blue-700">Auth Info Endpoint:</strong>
                  <pre className="mt-1 text-blue-600 bg-blue-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(apiTest.authInfo, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
