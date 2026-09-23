const os = require('os');
const logger = require('../config/loggerConfig');
const { getRequestContext } = require('../middlewares/requestContext');

// Lazy require - ErrorLog pulls in mongoose, and logger.js is required by
// very early code (e.g. middlewares) before the DB connection is
// necessarily ready. Delaying the require to first use avoids any
// module-load-order issues.
let ErrorLog = null;
function getErrorLogModel() {
    if (!ErrorLog) ErrorLog = require('../models/ErrorLog');
    return ErrorLog;
}

const SENSITIVE_KEY_PATTERN = /password|token|secret|otp|cvv|card|pin|authorization/i;

// Recursively masks any key matching SENSITIVE_KEY_PATTERN before a request
// body/params/query or extra call-site data ever reaches the database.
function redact(value) {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
        const clone = {};
        for (const [key, val] of Object.entries(value)) {
            clone[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(val);
        }
        return clone;
    }
    return value;
}

// Normalizes the shapes logException's `data` comes in as - a bare Error, or
// an object holding the Error under `error` or any other key (call sites use
// { err }, { mergeErr }, { fetchErr } too) - into { error, additionalData }.
function normalizeErrorData(data) {
    if (data instanceof Error) {
        return { error: data, additionalData: {} };
    }
    if (data && typeof data === 'object') {
        const errorKey = data.error instanceof Error
            ? 'error'
            : Object.keys(data).find((key) => data[key] instanceof Error);
        if (errorKey) {
            const { [errorKey]: error, ...additionalData } = data;
            return { error, additionalData };
        }
    }
    return { error: null, additionalData: data || {} };
}

// Fire-and-forget: never awaited by logException, and every failure is
// swallowed (logged via pino only) so a DB hiccup can never turn a caught
// exception into an unhandled rejection or slow down the response.
async function persistErrorLog(message, error, additionalData, severity = 'ERROR') {
    try {
        const ctx = getRequestContext();
        const req = ctx?.req || null;
        const { vendorId: explicitVendorId, ...restAdditionalData } = additionalData || {};
        const vendorId = explicitVendorId || req?.vendorId || null;

        // Required field on ErrorLog - if there's genuinely no vendor context
        // (e.g. a background job, or a failure before vendorDetection ran),
        // skip DB persistence; the pino log above already captured it.
        if (!vendorId) return;

        const Model = getErrorLogModel();
        await Model.create({
            vendorId,
            message,
            severity,
            errorName: error?.name || null,
            errorMessage: error?.message || null,
            stack: error?.stack || null,
            environment: process.env.NODE_ENV || 'development',
            server: { hostname: os.hostname(), pid: process.pid },
            requestId: ctx?.requestId || null,
            request: req ? {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers?.['user-agent'] || null,
                params: redact(req.params),
                query: redact(req.query),
                body: redact(req.body)
            } : null,
            user: req?.user ? {
                userId: req.user._id,
                role: req.user.role,
                country: req.user.country,
                state: req.user.state,
                city: req.user.city
            } : null,
            additionalData: Object.keys(restAdditionalData).length ? redact(restAdditionalData) : null
        });
    } catch (persistErr) {
        logger.error({
            error: { message: persistErr.message, stack: persistErr.stack, name: persistErr.name }
        }, 'Failed to persist ErrorLog document');
    }
}

function logInfo(success, failure, message, meta = {}) {
  logger.info(meta, message);
}

function writeLog(level, message, data, error, additionalData) {
    if (error) {
        logger[level]({
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            ...additionalData
        }, message);
    } else {
        logger[level](data, message);
    }
}

// The body of the 500 logException() sends: the usual { success, message, data }
// shape, with data.errorReference = the requestId stored on the ErrorLog so the
// error page can show it and the developer can look the record up. The real
// error message is only included outside production; a stack never is.
function buildExceptionResponse(requestId, message, error) {
    const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
    return {
        success: false,
        message: 'Something went wrong. Please try again.',
        data: {
            errorReference: requestId || null,
            ...(isDevelopment ? { errorDetails: error?.message || message } : {})
        }
    };
}

// Answers the in-flight request with a 500 unless something already answered
// it (or there is no request, e.g. a background job). Never throws.
function sendExceptionResponse(message, error) {
    try {
        const ctx = getRequestContext();
        const res = ctx?.res;
        if (!res || res.headersSent || res.writableEnded) return;
        res.status(500).json(buildExceptionResponse(ctx.requestId, message, error));
    } catch (sendErr) {
        logger.error({
            error: { message: sendErr.message, stack: sendErr.stack, name: sendErr.name }
        }, 'Failed to send the exception response');
    }
}

// The request FAILED: logs, saves an ErrorLog (severity ERROR) and answers the
// request with a 500 so the frontend shows the error page with the reference.
// Controllers' catch blocks call only this.
function logException(message, data = {}) {
    const { error, additionalData } = normalizeErrorData(data);
    writeLog('error', message, data, error, additionalData);

    // Not awaited on purpose - logException must stay a synchronous, fire-and-forget
    // call for every one of its existing call sites (per the house catch-block rule).
    persistErrorLog(message, error, additionalData, 'ERROR').catch(() => {});
    sendExceptionResponse(message, error);
}

// Something went wrong but the request CARRIES ON (a failed invoice email, a
// Redis miss with a DB fallback, a background job): logs and saves an ErrorLog
// (severity WARNING) but never answers the request. Services use this.
function logWarning(message, data = {}) {
    const { error, additionalData } = normalizeErrorData(data);
    writeLog('warn', message, data, error, additionalData);
    persistErrorLog(message, error, additionalData, 'WARNING').catch(() => {});
}

module.exports = {
  logInfo,
  logException,
  logWarning
};