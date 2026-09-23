const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

// Lets utils/logger.js's logException() reach the in-flight `req` (for
// vendorId, req.user, method/url/params/query/body) from anywhere in the
// controller/service call chain, without every one of the ~100 existing
// logException(message, data) call sites needing to be changed to pass req
// explicitly. Must be the very first middleware mounted in server.js so
// every downstream middleware/controller/service runs inside als.run().
const als = new AsyncLocalStorage();

const requestContext = (req, res, next) => {
    const requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    // res is kept too so logException() can answer a failed request itself
    // (a 500 carrying requestId as the error reference) - see utils/logger.js.
    als.run({ req, res, requestId }, () => next());
};

const getRequestContext = () => als.getStore() || null;

module.exports = { requestContext, getRequestContext };
