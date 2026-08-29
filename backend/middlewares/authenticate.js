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

    req.user = { _id: user._id, role: user.role, country: user.country, state: user.state, city: user.city };

    next();
  } catch (error) {
    logException("Exception in authenticate middleware", error);
  }
};

// Guest-tolerant variant, for routes that must serve BOTH logged-in users
// and anonymous visitors (e.g. cart). If a valid token is present, behaves
// identically to authenticate() above and sets req.user. If there's no
// token, or it's invalid/expired, or the user is deleted/inactive, it does
// NOT reject the request - it just calls next() with req.user left unset,
// so the request is treated as a guest instead of being blocked.
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
      return next();
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.status === "D" || user.status === "I") {
      return next();
    }

    req.user = { _id: user._id, role: user.role, country: user.country, state: user.state, city: user.city };

    next();
  } catch (error) {
    logException("Exception in authenticate.optional middleware", error);
    next();
  }
};

module.exports = authenticate;