// Shared logging utility

const createLogger = (serviceName) => {
  const log = (level, message, meta = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: serviceName,
      level,
      message,
      ...meta
    };

    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(`[${logEntry.timestamp}] ${serviceName} ${level.toUpperCase()}: ${message}`, meta);
    }
  };

  return {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    debug: (message, meta) => log('debug', message, meta)
  };
};

// Create a default logger for general use
const defaultLogger = createLogger('shared');

module.exports = {
  createLogger,
  info: defaultLogger.info,
  warn: defaultLogger.warn,
  error: defaultLogger.error,
  debug: defaultLogger.debug
};