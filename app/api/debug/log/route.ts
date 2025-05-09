import { NextResponse } from 'next/server'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export async function POST(request: Request) {
  try {
    const { level, message, data } = await request.json()
    
    const validLevels: LogLevel[] = ['info', 'warn', 'error', 'debug']
    const logLevel = validLevels.includes(level as LogLevel) ? level as LogLevel : 'info'
    
    // Format the log data for better readability
    const timestamp = new Date().toISOString()
    const formattedData = typeof data === 'object' ? JSON.stringify(data, null, 2) : data
    
    // Log to server console with appropriate level
    console[logLevel](`[${timestamp}] [${logLevel.toUpperCase()}] ${message}`, 
      formattedData ? `\n${formattedData}` : '')
    
    return NextResponse.json({
      success: true,
      message: 'Log recorded'
    })
  } catch (error: any) {
    console.error('Error recording log:', error)
    return NextResponse.json({
      success: false,
      message: `Failed to record log: ${error.message}`
    }, { status: 500 })
  }
} 