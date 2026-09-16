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

// Normalizes the two shapes logException's `data` currently comes in as
// (a bare Error, or an object with an `error` key) into { error, additionalData }.
function normalizeErrorData(data) {
    if (data instanceof Error) {
        return { error: data, additionalData: {} };
    }
    if (data && data.error instanceof Error) {
        const { error, ...additionalData } = data;
        return { error, additionalData };
    }
    return { error: null, additionalData: data || {} };
}

// Fire-and-forget: never awaited by logException, and every failure is
// swallowed (logged via pino only) so a DB hiccup can never turn a caught
// exception into an unhandled rejection or slow down the response.
async function persistErrorLog(message, error, additionalData) {
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

function logException(message, data = {}) {
    const { error, additionalData } = normalizeErrorData(data);

    if (error) {
        logger.error({
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            ...additionalData
        }, message);
    } else {
        logger.error(data, message);
    }

    // Not awaited on purpose - logException must stay a synchronous, fire-and-forget
    // call for every one of its existing call sites (per the house catch-block rule).
    persistErrorLog(message, error, additionalData).catch(() => {});
}

module.exports = {
  logInfo,
  logException
};