const multer = require('multer');
const common = require('../utils/common');
const logger = require('../utils/logger');

// A request error that is the caller's fault, not the server's: a multer
// rejection (too large, too many files), an unparsable JSON body, or any error
// already carrying a 4xx status (e.g. an upload fileFilter's wrong-format error).
const clientErrorStatus = (err) => {
    try {
        if (err instanceof multer.MulterError) {
            return err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        }
        const status = err?.status || err?.statusCode;
        if (Number.isInteger(status) && status >= 400 && status < 500) {
            return status;
        }
        return null;
    } catch (err2) {
        throw err2;
    }
};

// Last middleware in server.js: catches anything thrown or next(err)'d outside
// a controller's own try/catch. Client errors get a plain 4xx with their
// message; everything else goes through logException(), which saves the
// ErrorLog and answers with the 500 + error reference the error page shows.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    try {
        const status = clientErrorStatus(err);
        if (status) {
            logger.logWarning('Request rejected by errorHandler', { error: err });
            return common.sendError(res, status, err.message || 'Invalid request.');
        }
        logger.logException('Unhandled exception reached errorHandler', { error: err });
    } catch (handlerErr) {
        logger.logException('Exception in errorHandler middleware', { error: handlerErr });
    }
};

module.exports = errorHandler;
