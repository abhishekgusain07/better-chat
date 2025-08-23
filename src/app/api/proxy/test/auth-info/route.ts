import { NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export async function GET(request: NextRequest) {
  try {
    // Forward cookies from the frontend request to backend
    const cookies = request.headers.get('cookie')

    const response = await fetch(`${BACKEND_URL}/api/v1/test/auth-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookies && { Cookie: cookies }),
      },
    })

    const data = await response.json()

    return Response.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return Response.json(
      { error: 'Failed to proxy request', message: String(error) },
      { status: 500 }
    )
  }
}
