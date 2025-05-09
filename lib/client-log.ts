/**
 * Client-side logging utility for sending logs to the server
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/**
 * Send a log message to the server
 * @param level Log level: 'info', 'warn', 'error', or 'debug'
 * @param message The log message
 * @param data Optional data to include with the log
 */
export async function serverLog(level: LogLevel, message: string, data?: any): Promise<void> {
  try {
    // First log to browser console
    console[level](message, data)
    
    // Then send to server
    const response = await fetch('/api/debug/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level,
        message,
        data
      }),
    })
    
    if (!response.ok) {
      console.error('Failed to send log to server:', await response.text())
    }
  } catch (error) {
    // Fall back to local console if sending fails
    console.error('Error sending log to server:', error)
  }
}

// Convenience methods
export const log = {
  info: (message: string, data?: any) => serverLog('info', message, data),
  warn: (message: string, data?: any) => serverLog('warn', message, data),
  error: (message: string, data?: any) => serverLog('error', message, data),
  debug: (message: string, data?: any) => serverLog('debug', message, data),
} 