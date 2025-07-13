/**
 * Lightweight logger with memory-efficient circular buffer
 * Prevents memory issues from excessive logging
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

class CircularLogBuffer {
  private buffer: LogEntry[] = [];
  private maxSize: number;
  private pointer: number = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  add(entry: LogEntry): void {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(entry);
    } else {
      this.buffer[this.pointer] = entry;
      this.pointer = (this.pointer + 1) % this.maxSize;
    }
  }

  getRecent(count: number = 100): LogEntry[] {
    const entries = [...this.buffer];
    return entries.slice(-count);
  }

  clear(): void {
    this.buffer = [];
    this.pointer = 0;
  }

  getStats(): { totalLogged: number; currentSize: number } {
    return {
      totalLogged: this.buffer.length + (this.pointer > 0 ? this.maxSize : 0),
      currentSize: this.buffer.length
    };
  }
}

class Logger {
  private static instance: Logger;
  private buffer: CircularLogBuffer;
  private currentLevel: LogLevel = LogLevel.INFO;
  private isDevelopment: boolean;
  private logToConsole: boolean = true;
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  private constructor() {
    this.buffer = new CircularLogBuffer(1000);
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // In production, default to less verbose logging
    if (!this.isDevelopment) {
      this.currentLevel = LogLevel.WARN;
    }

    // Periodically clean up rate limit map
    setInterval(() => {
      const now = Date.now();
      for (const [key, limit] of this.rateLimits.entries()) {
        if (limit.resetTime < now) {
          this.rateLimits.delete(key);
        }
      }
    }, 60000); // Every minute
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  setConsoleOutput(enabled: boolean): void {
    this.logToConsole = enabled;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  private checkRateLimit(key: string, maxPerMinute: number = 60): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(key);

    if (!limit || limit.resetTime < now) {
      this.rateLimits.set(key, {
        count: 1,
        resetTime: now + 60000 // 1 minute
      });
      return true;
    }

    if (limit.count >= maxPerMinute) {
      return false;
    }

    limit.count++;
    return true;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, rateKey?: string): void {
    if (!this.shouldLog(level)) return;

    // Apply rate limiting if key provided
    if (rateKey && !this.checkRateLimit(rateKey)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context
    };

    this.buffer.add(entry);

    if (this.logToConsole) {
      const levelStr = LogLevel[level];
      const prefix = `[${levelStr}] ${entry.timestamp.toISOString()}:`;

      switch (level) {
        case LogLevel.ERROR:
          console.error(prefix, message, context || '');
          break;
        case LogLevel.WARN:
          console.warn(prefix, message, context || '');
          break;
        case LogLevel.INFO:
          console.warn(prefix, message, context || '');
          break;
        case LogLevel.DEBUG:
          if (this.isDevelopment) {
            console.warn(prefix, message, context || '');
          }
          break;
      }
    }
  }

  error(message: string, context?: Record<string, unknown>, rateKey?: string): void {
    this.log(LogLevel.ERROR, message, context, rateKey);
  }

  warn(message: string, context?: Record<string, unknown>, rateKey?: string): void {
    this.log(LogLevel.WARN, message, context, rateKey);
  }

  info(message: string, context?: Record<string, unknown>, rateKey?: string): void {
    this.log(LogLevel.INFO, message, context, rateKey);
  }

  debug(message: string, context?: Record<string, unknown>, rateKey?: string): void {
    this.log(LogLevel.DEBUG, message, context, rateKey);
  }

  getRecentLogs(count: number = 100): LogEntry[] {
    return this.buffer.getRecent(count);
  }

  getStats() {
    return {
      ...this.buffer.getStats(),
      currentLevel: this.currentLevel,
      currentLevelName: LogLevel[this.currentLevel],
      rateLimitedKeys: this.rateLimits.size
    };
  }

  clearLogs(): void {
    this.buffer.clear();
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logError = (message: string, context?: Record<string, unknown>, rateKey?: string) => 
  logger.error(message, context, rateKey);

export const logWarn = (message: string, context?: Record<string, unknown>, rateKey?: string) => 
  logger.warn(message, context, rateKey);

export const logInfo = (message: string, context?: Record<string, unknown>, rateKey?: string) => 
  logger.info(message, context, rateKey);

export const logDebug = (message: string, context?: Record<string, unknown>, rateKey?: string) => 
  logger.debug(message, context, rateKey);