const logger = require('../config/loggerConfig');

function logInfo(success, failure, message, meta = {}) {
  logger.info(meta, message);
}

function logException(message, data = {}) {
    if (data instanceof Error) {
        return logger.error({
            error: {
                message: data.message,
                stack: data.stack,
                name: data.name
            }
        }, message);
    }

    if (data.error instanceof Error) {
        return logger.error({
            ...data,
            error: {
                message: data.error.message,
                stack: data.error.stack,
                name: data.error.name
            }
        }, message);
    }

    logger.error(data, message);
}

module.exports = {
  logInfo,
  logException
};