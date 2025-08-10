'use client'
import { Button } from '@/components/ui/button'
import { signOut, useSession } from '@/lib/auth-client'
import Link from 'next/link'

export default function Home() {
  const { data: session } = useSession()
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-black rounded flex items-center justify-center">
            <span className="text-white font-bold text-xl">M</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-light tracking-tight text-gray-900">
            Minimalist Template
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-md mx-auto">
            A clean, simple, and elegant starting point for your Next.js
            project.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          {session?.user ? (
            <div className="flex gap-4">
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-black text-white hover:bg-gray-800 rounded-md px-8 py-3 text-base"
                >
                  Dashboard
                </Button>
              </Link>
              <Button onClick={() => signOut()} size="lg" variant="outline">
                Logout
              </Button>
            </div>
          ) : (
            <>
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-black text-white hover:bg-gray-800 rounded-md px-8 py-3 text-base"
                >
                  Sign Up
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-gray-300 text-gray-900 hover:bg-gray-50 rounded-md px-8 py-3 text-base"
                >
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Features */}
        <div className="pt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="space-y-3">
            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-700"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900">Simple Design</h3>
            <p className="text-gray-600 text-sm">
              Clean interface with minimal distractions for better focus.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-700"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900">User-Friendly</h3>
            <p className="text-gray-600 text-sm">
              Intuitive navigation and clear calls to action.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-700"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900">Modern Stack</h3>
            <p className="text-gray-600 text-sm">
              Built with Next.js and the latest web technologies.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-16 text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()} Minimalist Template. All rights
            reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
