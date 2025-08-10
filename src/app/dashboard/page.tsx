'use client'
import { useState } from 'react'
import { trpc } from '@/trpc/provider'

export default function DashboardPage() {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')

  const { data: hello, isLoading: helloLoading } = trpc.example.hello.useQuery(
    { text: 'Dashboard User' },
    {
      refetchOnWindowFocus: false,
    }
  )

  const {
    data: user,
    isLoading: userLoading,
    error: userError,
  } = trpc.example.getUser.useQuery()

  const updateProfileMutation = trpc.example.updateProfile.useMutation({
    onSuccess: (data) => {
      console.log('Profile updated:', data)
    },
    onError: (error) => {
      console.error('Profile update failed:', error)
    },
  })

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      await updateProfileMutation.mutateAsync({
        name: name.trim(),
        bio: bio.trim() || undefined,
      })
      setName('')
      setBio('')
    } catch (error) {
      console.error('Failed to update profile:', error)
    }
  }

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-light text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your account and settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hello Query Demo */}
          <div className="bg-white border border-gray-100 p-6 rounded-lg">
            <h2 className="text-xl font-medium text-gray-900 mb-4">
              Public Query
            </h2>
            {helloLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-700">
                  <span className="font-medium">Message:</span>{' '}
                  {hello?.greeting}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Timestamp:</span>{' '}
                  {hello?.timestamp}
                </p>
              </div>
            )}
          </div>

          {/* Protected Query Demo */}
          <div className="bg-white border border-gray-100 p-6 rounded-lg">
            <h2 className="text-xl font-medium text-gray-900 mb-4">
              Protected Query
            </h2>
            {userLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ) : userError ? (
              <div className="text-red-600">
                <p className="font-medium">Authentication Required</p>
                <p className="text-sm mt-1">{userError.message}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-700">{user?.message}</p>
                <p className="text-sm text-gray-500">
                  User ID: {user?.user?.id || 'Not available'}
                </p>
              </div>
            )}
          </div>

          {/* Mutation Demo */}
          <div className="bg-white border border-gray-100 p-6 rounded-lg lg:col-span-2">
            <h2 className="text-xl font-medium text-gray-900 mb-4">
              Update Profile
            </h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label
                  htmlFor="bio"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Bio (optional)
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  placeholder="Tell us about yourself"
                />
              </div>
              <button
                type="submit"
                disabled={updateProfileMutation.isPending || !name.trim()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Updating...
                  </div>
                ) : (
                  'Update Profile'
                )}
              </button>
            </form>

            {updateProfileMutation.isSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 text-sm">
                  Profile updated successfully
                </p>
              </div>
            )}

            {updateProfileMutation.isError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">
                  Update failed: {updateProfileMutation.error?.message}
                </p>
              </div>
            )}
          </div>

          {/* tRPC Features Showcase */}
          <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg lg:col-span-2">
            <h2 className="text-xl font-medium text-gray-900 mb-4">
              tRPC Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">Type Safety</h3>
                <p className="text-sm text-gray-600">
                  Full TypeScript inference from server to client
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">Protected Routes</h3>
                <p className="text-sm text-gray-600">
                  Authentication middleware for secure endpoints
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">
                  React Query Integration
                </h3>
                <p className="text-sm text-gray-600">
                  Caching, loading states, and error handling
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">Real-time Updates</h3>
                <p className="text-sm text-gray-600">
                  Optimistic updates and automatic invalidation
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
