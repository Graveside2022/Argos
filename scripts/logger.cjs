/**
 * Simple Node.js Script Logger
 * Mirrors the main logger structure for script usage
 * 
 * This provides structured logging for Node.js scripts while maintaining
 * compatibility with the main application logger pattern.
 */

const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class ScriptLogger {
  constructor() {
    this.currentLevel = LogLevel.INFO;
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logToConsole = true;
    
    // In production, default to less verbose logging
    if (!this.isDevelopment) {
      this.currentLevel = LogLevel.WARN;
    }
  }

  setLevel(level) {
    this.currentLevel = level;
  }

  setConsoleOutput(enabled) {
    this.logToConsole = enabled;
  }

  shouldLog(level) {
    return level <= this.currentLevel;
  }

  log(level, message, context) {
    if (!this.shouldLog(level)) return;

    if (this.logToConsole) {
      const levelStr = Object.keys(LogLevel).find(key => LogLevel[key] === level);
      const timestamp = new Date().toISOString();
      const prefix = `[${levelStr}] ${timestamp}:`;

      switch (level) {
        case LogLevel.ERROR:
          console.error(prefix, message, context || '');
          break;
        case LogLevel.WARN:
          console.warn(prefix, message, context || '');
          break;
        case LogLevel.INFO:
          console.log(prefix, message, context || '');
          break;
        case LogLevel.DEBUG:
          if (this.isDevelopment) {
            console.log(prefix, message, context || '');
          }
          break;
      }
    }
  }

  error(message, context) {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message, context) {
    this.log(LogLevel.WARN, message, context);
  }

  info(message, context) {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message, context) {
    this.log(LogLevel.DEBUG, message, context);
  }

  getStats() {
    return {
      currentLevel: this.currentLevel,
      currentLevelName: Object.keys(LogLevel).find(key => LogLevel[key] === this.currentLevel),
      isDevelopment: this.isDevelopment
    };
  }
}

// Export singleton instance
const logger = new ScriptLogger();

// Export convenience functions
const logError = (message, context) => logger.error(message, context);
const logWarn = (message, context) => logger.warn(message, context);
const logInfo = (message, context) => logger.info(message, context);
const logDebug = (message, context) => logger.debug(message, context);

module.exports = {
  LogLevel,
  logger,
  logError,
  logWarn,
  logInfo,
  logDebug
};