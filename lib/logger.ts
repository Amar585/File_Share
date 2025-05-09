/**
 * Simple logger utility for client and server components
 */

class Logger {
  private namespace: string;

  constructor(namespace: string = 'app') {
    this.namespace = namespace;
  }

  /**
   * Create a child logger with a sub-namespace
   */
  child({ module }: { module: string }): Logger {
    return new Logger(`${this.namespace}:${module}`);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.info(`[${this.namespace}] [INFO] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn(`[${this.namespace}] [WARN] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'production') {
      console.error(`[${this.namespace}] [ERROR] ${message}`, ...args);
    }
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, ...args: any[]): void {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.debug(`[${this.namespace}] [DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
