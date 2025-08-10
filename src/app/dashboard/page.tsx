'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/provider'
import { Button } from '@/components/ui/button'

const DashboardPage = () => {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')

  // tRPC queries
  const helloQuery = trpc.example.hello.useQuery({ text: 'from Dashboard!' })
  const userQuery = trpc.example.getUser.useQuery(undefined, {
    retry: false, // Don't retry on auth errors
  })

  // tRPC mutation
  const updateProfileMutation = trpc.example.updateProfile.useMutation({
    onSuccess: (data) => {
      console.log('Profile updated:', data)
      // Reset form
      setName('')
      setBio('')
    },
    onError: (error) => {
      console.error('Failed to update profile:', error)
    },
  })

  const handleUpdateProfile = () => {
    if (name.trim()) {
      updateProfileMutation.mutate({
        name: name.trim(),
        bio: bio.trim() || undefined,
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            tRPC Dashboard Demo
          </h1>
          <p className="text-slate-600 text-lg">
            This dashboard demonstrates how tRPC works in your SaaS template
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Public Query Demo */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              🔓 Public Query Example
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="font-medium text-slate-700 mb-2">Hello Query</h3>
                {helloQuery.isLoading ? (
                  <p className="text-slate-500">Loading...</p>
                ) : helloQuery.isError ? (
                  <p className="text-red-500">Error: {helloQuery.error.message}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-slate-600">
                      <span className="font-medium">Greeting:</span> {helloQuery.data?.greeting}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium">Timestamp:</span> {helloQuery.data?.timestamp}
                    </p>
                  </div>
                )}
              </div>
              <Button
                onClick={() => helloQuery.refetch()}
                disabled={helloQuery.isLoading}
                className="w-full"
              >
                {helloQuery.isLoading ? 'Refreshing...' : 'Refresh Data'}
              </Button>
            </div>
          </div>

          {/* Protected Query Demo */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              🔒 Protected Query Example
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="font-medium text-slate-700 mb-2">User Info Query</h3>
                {userQuery.isLoading ? (
                  <p className="text-slate-500">Loading...</p>
                ) : userQuery.isError ? (
                  <div className="text-red-500">
                    <p className="font-medium">Authentication Required</p>
                    <p className="text-sm">{userQuery.error.message}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-slate-600">
                      <span className="font-medium">Message:</span> {userQuery.data?.message}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium">User ID:</span> {userQuery.data?.user?.id}
                    </p>
                  </div>
                )}
              </div>
              <Button
                onClick={() => userQuery.refetch()}
                disabled={userQuery.isLoading}
                className="w-full"
              >
                {userQuery.isLoading ? 'Refreshing...' : 'Refresh User Data'}
              </Button>
            </div>
          </div>

          {/* Mutation Demo */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              ✏️ Protected Mutation Example
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bio (Optional)
                  </label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Enter your bio"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <Button
                onClick={handleUpdateProfile}
                disabled={updateProfileMutation.isPending || !name.trim()}
                className="w-full"
              >
                {updateProfileMutation.isPending ? 'Updating...' : 'Update Profile'}
              </Button>
              {updateProfileMutation.isSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">Profile updated successfully!</p>
                </div>
              )}
              {updateProfileMutation.isError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium">Failed to update profile</p>
                  <p className="text-red-600 text-sm">{updateProfileMutation.error.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* tRPC Explanation */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 lg:col-span-2">
            <h2 className="text-2xl font-semibold text-blue-900 mb-4">
              🚀 How tRPC Works in This Template
            </h2>
            <div className="space-y-4 text-blue-800">
              <div>
                <h3 className="font-semibold mb-2">What is tRPC?</h3>
                <p className="text-blue-700">
                  tRPC (TypeScript Remote Procedure Call) provides end-to-end typesafe APIs without 
                  code generation or runtime bloat. It's perfect for full-stack TypeScript applications.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Key Benefits:</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>Type Safety:</strong> Full end-to-end type safety between client and server</li>
                  <li><strong>Auto-completion:</strong> IDE support with full IntelliSense</li>
                  <li><strong>Runtime Validation:</strong> Built-in Zod schema validation</li>
                  <li><strong>Error Handling:</strong> Structured error handling with proper typing</li>
                  <li><strong>Performance:</strong> Optimized with React Query for caching and state management</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Architecture:</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>Server:</strong> tRPC routers with procedures (queries/mutations)</li>
                  <li><strong>Client:</strong> React hooks for data fetching and mutations</li>
                  <li><strong>API Route:</strong> Next.js API route that handles tRPC requests</li>
                  <li><strong>Context:</strong> Authentication and user context for protected routes</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">File Structure:</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><code>src/trpc/routers/</code> - API route definitions</li>
                  <li><code>src/trpc/init.ts</code> - tRPC configuration and middleware</li>
                  <li><code>src/trpc/provider.tsx</code> - React provider for tRPC</li>
                  <li><code>src/app/api/trpc/</code> - Next.js API route handler</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage