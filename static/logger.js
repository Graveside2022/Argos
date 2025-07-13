/**
 * Simple browser-compatible structured logger for static files
 * Provides consistent logging across the application
 */
(function () {
	'use strict';

	// Log levels
	const LogLevel = {
		DEBUG: 0,
		INFO: 1,
		WARN: 2,
		ERROR: 3
	};

	// Current log level (can be changed for debugging)
	let currentLogLevel = LogLevel.INFO;

	// Utility function to format timestamp
	function formatTimestamp() {
		return new Date().toISOString();
	}

	// Core logging function
	function log(level, levelName, message, ...args) {
		if (level < currentLogLevel) {
			return;
		}

		const timestamp = formatTimestamp();
		const prefix = `[${timestamp}] [${levelName}]`;

		// Use appropriate console method based on level
		switch (level) {
			case LogLevel.DEBUG:
				console.debug(prefix, message, ...args);
				break;
			case LogLevel.INFO:
				console.info(prefix, message, ...args);
				break;
			case LogLevel.WARN:
				console.warn(prefix, message, ...args);
				break;
			case LogLevel.ERROR:
				console.error(prefix, message, ...args);
				break;
			default:
				console.log(prefix, message, ...args);
		}
	}

	// Export logging functions to global scope
	window.logDebug = function (message, ...args) {
		log(LogLevel.DEBUG, 'DEBUG', message, ...args);
	};

	window.logInfo = function (message, ...args) {
		log(LogLevel.INFO, 'INFO', message, ...args);
	};

	window.logWarn = function (message, ...args) {
		log(LogLevel.WARN, 'WARN', message, ...args);
	};

	window.logError = function (message, ...args) {
		log(LogLevel.ERROR, 'ERROR', message, ...args);
	};

	// Utility function to set log level (for debugging)
	window.setLogLevel = function (level) {
		if (typeof level === 'string') {
			level = LogLevel[level.toUpperCase()];
		}
		if (level >= LogLevel.DEBUG && level <= LogLevel.ERROR) {
			currentLogLevel = level;
			window.logInfo('Log level set to:', Object.keys(LogLevel)[level]);
		} else {
			window.logWarn('Invalid log level:', level);
		}
	};

	// Initialize with info message
	window.logInfo('Structured logger initialized');
})();
