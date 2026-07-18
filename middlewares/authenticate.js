const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendError } = require("../utils/common");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return sendError(res, 401, "Access token is required.");

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError")
        return sendError(res, 401, "Access token has expired.");
      return sendError(res, 401, "Invalid access token.");
    }

    const user = await User.findById(decoded._id);

    if (!user)
      return sendError(res, 401, "User no longer exists.");

    if (!user.isActive)
      return sendError(res, 403, "Your account has been deactivated. Please contact support.");

    req.user = { _id: user._id, role: user.role };

    next();
  } catch (error) {
    console.error("[authenticate]", error);
    return sendError(res, 500, "Internal server error.");
  }
};

module.exports = authenticate;