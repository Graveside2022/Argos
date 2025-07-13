import { logger, LogLevel } from '$lib/utils/logger';

// Configure logging based on environment
export function configureLogging() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
  
  // Set log level
  switch (logLevel) {
    case 'ERROR':
      logger.setLevel(LogLevel.ERROR);
      break;
    case 'WARN':
      logger.setLevel(LogLevel.WARN);
      break;
    case 'INFO':
      logger.setLevel(LogLevel.INFO);
      break;
    case 'DEBUG':
      logger.setLevel(LogLevel.DEBUG);
      break;
    default:
      logger.setLevel(nodeEnv === 'production' ? LogLevel.WARN : LogLevel.INFO);
  }
  
  // In production, we might want to reduce console output
  if (nodeEnv === 'production') {
    logger.setConsoleOutput(true);
  }
  
  // Get the current level from logger stats
  const stats = logger.getStats();
  console.warn(`Logging configured: level=${stats.currentLevelName}, env=${nodeEnv}`);
}

// Export for use in app initialization
export { logger, LogLevel };