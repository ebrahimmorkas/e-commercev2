const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendError } = require("../utils/common");
const { logException } = require("../utils/logger");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return sendError(res, 401, "Please Login Again");

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError")
        return sendError(res, 401, "Please Login Again");
      return sendError(res, 401, "Please Login Again");
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.status === "D")
      return sendError(res, 401, "User not found");

    if (user.status === "I")
      return sendError(res, 403, "Your account has been deactivated. Please contact support.");

    // Tenant check: a token only works on the store its user belongs to.
    // vendorDetection (mounted app-wide in server.js) has already resolved
    // req.vendorId from the hostname, so without this an admin of store A
    // could call store B's domain with A's token and act on B's data.
    if (isForeignVendor(user, req))
      return sendError(res, 403, "You do not have access to this store.");

    req.user = { _id: user._id, role: user.role, vendorId: user.vendorId, country: user.country, state: user.state, city: user.city };

    next();
  } catch (error) {
    logException("Exception in authenticate middleware", error);
    // Never leave the request hanging if something unexpected throws (e.g. a
    // DB error while loading the user) - the caller would wait forever.
    if (!res.headersSent) sendError(res, 500, "Something went wrong. Please try again.");
  }
};

// True only when both sides are known AND differ - a user record or request
// without a vendorId (legacy data, or a route that runs before vendor
// detection) is left to the rest of the middleware chain instead of being
// locked out here.
const isForeignVendor = (user, req) =>
  !!user.vendorId && !!req.vendorId && user.vendorId.toString() !== req.vendorId.toString();

// Guest-tolerant variant, for routes that must serve BOTH logged-in users
// and anonymous visitors (e.g. cart). If a valid token is present, behaves
// identically to authenticate() above and sets req.user. If there's no
// token at all, or it's malformed/invalid, or the user is deleted/inactive,
// it does NOT reject the request - it just calls next() with req.user left
// unset, so the request is treated as a guest instead of being blocked.
//
// An EXPIRED token is deliberately NOT treated as "no token" here: it means
// a previously logged-in user's session merely went stale mid-visit, not
// that they're actually a guest. Silently falling back to guest in that
// case would fork their in-progress cart into a brand new guest-owned cart
// the moment their access token expires - so this returns 401 instead,
// which apiClient.js's refresh-and-retry already knows how to recover from
// transparently (refresh the token, retry the same request once).
authenticate.optional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return sendError(res, 401, "Please Login Again");
      }
      return next();
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.status === "D" || user.status === "I") {
      return next();
    }

    // A token from another store is simply not this store's user - treat the
    // request as a guest (same as an unknown token) rather than failing it.
    if (isForeignVendor(user, req)) {
      return next();
    }

    req.user = { _id: user._id, role: user.role, vendorId: user.vendorId, country: user.country, state: user.state, city: user.city };

    next();
  } catch (error) {
    logException("Exception in authenticate.optional middleware", error);
    next();
  }
};

module.exports = authenticate;