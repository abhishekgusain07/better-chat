import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headers = Object.fromEntries(request.headers.entries())

    console.log('🔔 WEBHOOK TEST: Received POST request')
    console.log('📋 Headers:', headers)
    console.log('📄 Body:', body)

    // Try to parse as JSON
    let jsonBody = null
    try {
      jsonBody = JSON.parse(body)
      console.log('✅ JSON Body parsed:', jsonBody)
    } catch (e) {
      console.log('❌ Failed to parse JSON:', e)
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook test received',
      timestamp: new Date().toISOString(),
      headers,
      bodyLength: body.length,
      hasJson: !!jsonBody,
    })
  } catch (error) {
    console.error('❌ Webhook test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Webhook test endpoint is running',
    timestamp: new Date().toISOString(),
  })
}
