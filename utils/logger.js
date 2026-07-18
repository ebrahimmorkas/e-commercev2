const logger = require('../config/loggerConfig');

function logInfo(success, failure, message, meta = {}) {
  logger.info(meta, message);
}

function logException(message, err = {}) {
  const errorData = err instanceof Error
    ? {
        message: err.message,
        stack: err.stack,
        name: err.name
      }
    : err;

  logger.error({ error: errorData }, message);
}

module.exports = {
  logInfo,
  logException
};