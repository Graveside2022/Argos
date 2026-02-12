// Simple logger for build scripts
const logError = (msg) => console.error(`❌ ERROR: ${msg}`);
const logWarn = (msg) => console.warn(`⚠️  WARN: ${msg}`);
const logInfo = (msg) => console.log(`ℹ️  INFO: ${msg}`);

module.exports = { logError, logWarn, logInfo };
