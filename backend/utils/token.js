const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (payload) => {
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m'
    });
};

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '30d'
    });
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};

// Refresh tokens are never stored raw in the DB - only their hash, so a DB leak
// alone can't be used to forge/replay sessions.
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

const resolveUserFromAuthHeader = async (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { ok: false, reason: 'NO_TOKEN' };
    }
 
    const token = authHeader.split(' ')[1];
 
    let decoded;
    try {
        decoded = verifyAccessToken(token);
    } catch (err) {
        // Covers both TokenExpiredError and a plain invalid signature -
        // authenticate.js has always shown the same "Please Login Again"
        // message for both, so that collapsing is preserved here.
        return { ok: false, reason: 'INVALID_TOKEN' };
    }
 
    const user = await User.findById(decoded.userId);
 
    // 'D' = deleted, treated as not found.
    if (!user || user.status === 'D') {
        return { ok: false, reason: 'NOT_FOUND' };
    }
 
    // 'I' = inactive - blocked from authenticating, but distinct from "not
    // found" so authenticate.js can keep returning its own 403 message.
    if (user.status === 'I') {
        return { ok: false, reason: 'INACTIVE' };
    }
 
    return {
        ok: true,
        user: {
            _id: user._id,
            role: user.role,
            vendorId: user.vendorId,
            country: user.country,
            state: user.state,
            city: user.city
        }
    };
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    hashToken,
    resolveUserFromAuthHeader
};