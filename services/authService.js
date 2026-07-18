const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, hashToken } = require('../utils/token');
require('dotenv').config();

const SALT_ROUNDS = process.env.SALT_ROUNDS;

const fail = (statusCode, message) => ({ error: true, statusCode, message });
const ok = (data) => ({ error: false, data });

const registerUser = async ({ vendorId, name, username, email, phone_no, whatsapp_no, password }) => {
    try {
        const existingUser = await User.findOne({
            $or: [{ username }, { email }, { phone_no }]
        });

        if (existingUser) {
            // Expected/business failure - NOT an exception, so we return, not throw.
            return fail(409, 'User already exists with the given username, email or phone number');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await User.create({
            vendorId,
            name,
            username,
            email,
            phone_no,
            whatsapp_no,
            password: hashedPassword,
            authProvider: 'local'
        });

        return ok({
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            phone_no: user.phone_no,
            role: user.role
        });
    } catch (err) {
        throw err;
    }
};

const loginUser = async ({ identifier, password }, deviceMeta) => {
    try {
        const user = await User.findOne({
            $or: [{ username: identifier }, { email: identifier }, { phone_no: identifier }],
            status: { $ne: 'D' }
        });

        if (!user) {
            return fail(401, 'Invalid credentials');
        }

        if (user.authProvider !== 'local' || !user.password) {
            return fail(400, `This account is registered via ${user.authProvider}. Please use that method to sign in.`);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return fail(401, 'Invalid credentials');
        }

        const accessToken = generateAccessToken({
            userId: user._id,
            role: user.role,
            vendorId: user.vendorId
        });

        const refreshToken = generateRefreshToken({ userId: user._id });
        const decodedRefresh = verifyRefreshToken(refreshToken);

        await RefreshToken.create({
            userId: user._id,
            tokenHash: hashToken(refreshToken),
            userAgent: deviceMeta.userAgent,
            ip: deviceMeta.ip,
            expiresAt: new Date(decodedRefresh.exp * 1000)
        });

        return ok({
            accessToken,
            refreshToken,
            user: {
                _id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        throw err;
    }
};

/**
 * Refresh token rotation:
 * - Verify JWT signature/expiry of the incoming refresh token.
 * - Match its hash against the session stored in DB for that user.
 * - If matched -> rotate: issue new access + refresh tokens, update the SAME session doc
 *   (so it stays tied to that one device, and the old token becomes unusable immediately).
 * - If not matched (token reused/invalid/unknown) -> expected failure, force re-login.
 */
const refreshAccessToken = async (incomingRefreshToken, deviceMeta) => {
    let session = null;
    try {
        if (!incomingRefreshToken) {
            return fail(401, 'Refresh token is missing');
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(incomingRefreshToken);
        } catch (verifyErr) {
            // Invalid/expired JWT is an expected outcome (token naturally expires,
            // gets tampered with, etc.) - not a server exception.
            return fail(401, 'Invalid or expired refresh token');
        }

        const incomingHash = hashToken(incomingRefreshToken);

        session = await RefreshToken.findOne({
            userId: decoded.userId,
            tokenHash: incomingHash,
            isValid: true
        });

        if (!session) {
            return fail(401, 'Session not found. Please login again');
        }

        if (session.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: session._id });
            return fail(401, 'Session expired. Please login again');
        }

        const user = await User.findById(decoded.userId);
        if (!user || user.status === 'D') {
            await RefreshToken.deleteOne({ _id: session._id });
            return fail(401, 'User not found or inactive');
        }

        const newRefreshToken = generateRefreshToken({ userId: user._id });
        const newDecoded = verifyRefreshToken(newRefreshToken);

        session.tokenHash = hashToken(newRefreshToken);
        session.expiresAt = new Date(newDecoded.exp * 1000);
        session.lastUsedAt = new Date();
        session.userAgent = deviceMeta.userAgent;
        session.ip = deviceMeta.ip;
        await session.save();

        const newAccessToken = generateAccessToken({
            userId: user._id,
            role: user.role,
            vendorId: user.vendorId
        });

        return ok({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (err) {
        // Genuine exception (e.g. session.save() failed mid-rotation). We already trusted
        // this session, so invalidate it defensively rather than leaving it in a half-rotated
        // or ambiguous state, then rethrow for the controller to log/redirect.
        if (session) {
            await RefreshToken.deleteOne({ _id: session._id }).catch(() => {});
        }
        throw err;
    }
};

const logoutUser = async (incomingRefreshToken) => {
    try {
        if (!incomingRefreshToken) {
            return fail(400, 'No active session found');
        }

        const incomingHash = hashToken(incomingRefreshToken);
        await RefreshToken.deleteOne({ tokenHash: incomingHash });

        return ok(true);
    } catch (err) {
        throw err;
    }
};

const logoutAllDevices = async (incomingRefreshToken) => {
    try {
        if (!incomingRefreshToken) {
            return fail(400, 'No active session found');
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(incomingRefreshToken);
        } catch (verifyErr) {
            return fail(401, 'Invalid or expired refresh token');
        }

        await RefreshToken.deleteMany({ userId: decoded.userId });

        return ok(true);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    logoutAllDevices
};