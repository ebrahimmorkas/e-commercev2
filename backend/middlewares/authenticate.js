const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendError } = require("../utils/common");
const { logException } = require("../utils/logger");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return sendError(res, 401, "Access token is required.");

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError")
        return sendError(res, 401, "Access token has expired.");
      return sendError(res, 401, "Invalid access token.");
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.status === "D")
      return sendError(res, 401, "User not found");

    // 'D' = deleted, 'I' = inactive - both are blocked from authenticating.
    if (user.status === "I")
      return sendError(res, 403, "Your account has been deactivated. Please contact support.");

    req.user = { _id: user._id, role: user.role, vendorId: user.vendorId };

    next();
  } catch (error) {
    logException("Exception in authenticate middleware", error);
  }
};

module.exports = authenticate;