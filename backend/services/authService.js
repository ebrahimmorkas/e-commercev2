const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, hashToken } = require('../utils/token');
const common = require('../utils/common');
const cartService = require('./cartService');
const logger = require('../utils/logger');
require('dotenv').config({ quiet: true });

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);

const getUserCount = async (vendorId) => {
    try {
        const count = await User.countDocuments({ vendorId, status: { $ne: 'D' } });
        return common.returnResult(true, 200, 'User count fetched successfully', { count });
    } catch (err) {
        throw err;
    }
};

const registerUser = async ({ vendorId, name, username, email, phone_no, whatsapp_no, password, country, state, city }) => {
    try {
        const existingUser = await User.findOne({
            vendorId,
            $or: [{ username }, { email }, { phone_no }]
        });

        if (existingUser) {
            return common.returnResult(false, 409, `User already exists with the given username, email or phone number`);
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
            authProvider: 'local',
            country,
            state,
            city
        });

        return common.returnResult(true, 201, `User registered successfully`, {
            user: { _id: user._id, name: user.name, username: user.username, email: user.email }
        });
    } catch (err) {
        // Handling of race condtion when register button is clicked at the same time for same credentials
        if (err.code === 11000) {
            return common.returnResult(false, 409, `User already exists with the given username, email or phone number`);
        }
        throw err;
    }
};

const loginUser = async ({ identifier, password }, deviceMeta, vendorId, guestCartId, locationContext, companyMasterData) => {
    try {
        if (!vendorId) {
            // Vendor detection fails
            return common.returnResult(false, 401, `Invalid credentials`);
        }
        const user = await User.findOne({
            vendorId,
            $or: [{ username: identifier }, { email: identifier }, { phone_no: identifier }],
            status: { $ne: 'D' }
        });

        if (!user) {
            return common.returnResult(false, 401, `Invalid credentials`);
        }

        if (user.authProvider !== 'local' || !user.password) {
            // return common.returnResult(false , 400, `This account is registered via ${user.authProvider}. Please use that method to sign in.`);
            return common.returnResult(false , 400, `Invalid credentials`);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return common.returnResult(false, 401, 'Invalid credentials');
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

                // Merge the guest cart (if any) into this user's cart now, inside
        // the same login flow, so it's atomic with login and can't be
        // skipped by the frontend forgetting to call a separate endpoint.
        // A merge failure must NOT fail the login itself - the user should
        // still get logged in even if, say, a product referenced in the
        // guest cart was deleted mid-merge. Log and move on.
        let cartMergeResult = null;
        if (guestCartId) {
            try {
                cartMergeResult = await cartService.mergeGuestCartIntoUserCart(vendorId, user._id, guestCartId, locationContext, companyMasterData);
            } catch (mergeErr) {
                logger.logException('Guest cart merge failed during login', { userId: user._id, guestCartId, mergeErr });
            }
        }

        return common.returnResult(true, 200, `Login Success`, { accessToken, refreshToken,
            user: { _id: user._id, name: user.name, username: user.username, email: user.email, role: user.role },
            cartMerged: !!(cartMergeResult && cartMergeResult.isSuccess)
        });
    } catch (err) {
        throw err;
    }
};

// Refresh tokens rotate (every successful refresh issues a new one), which
// creates two ways for a browser to end up holding a token the server has
// already rotated away from. Both are handled in refreshAccessToken, and both
// rely on the rotation itself being ATOMIC (a compare-and-swap):
//
// 1. Concurrent refreshes with the same cookie (two tabs, a StrictMode double
//    effect, rapid reloads). Only the request that wins the swap rotates and
//    sets a cookie; the others get a fresh access token but NO new refresh
//    token. Otherwise every request would mint its own token, the DB would
//    keep whichever was saved last while the browser kept whichever response
//    arrived last - and nothing forces those to be the same one.
//    REFRESH_CONCURRENT_WINDOW_MS is how long after a rotation a request
//    presenting the previous token is still treated as one of those racers.
//
// 2. A rotation whose response never reaches the browser (a page reload or
//    tab close aborts the fetch, a network drop) - the server moved on, but
//    the browser still holds the old token. The previous token therefore
//    stays usable for REFRESH_LOST_RESPONSE_GRACE_MS, and presenting it after
//    the concurrent window re-rotates so the browser is handed a working
//    cookie. Cost: the token rotated away from stays valid for this long (or
//    until the next rotation replaces it) instead of dying immediately - keep
//    it short. It must comfortably exceed the access token lifetime (15m): a
//    browser that got only an access token during the concurrent window still
//    holds the old cookie, and needs it once that access token expires.
const REFRESH_CONCURRENT_WINDOW_MS = 5 * 1000;
const REFRESH_LOST_RESPONSE_GRACE_MS = 30 * 60 * 1000;

/**
 * Refresh token rotation:
 * - Verify JWT signature/expiry of the incoming refresh token.
 * - Find the session by the token's hash - either as its current token, or as the token it
 *   most recently rotated away from (still inside REFRESH_LOST_RESPONSE_GRACE_MS).
 * - Rotate with one atomic findOneAndUpdate guarded on the state we just read, so of any
 *   number of concurrent refreshes exactly one rotates. Losers - and anyone presenting the
 *   previous token within REFRESH_CONCURRENT_WINDOW_MS of a rotation, whose new cookie is
 *   already on its way - get an access token only (`refreshToken: null`): the cookie the
 *   browser already has, or is about to receive, stays the one the DB knows.
 * - Not matched at all (unknown token, or previous token past its grace) -> expected
 *   failure, force re-login.
 */
const refreshAccessToken = async (incomingRefreshToken, deviceMeta) => {
    try {
        if (!incomingRefreshToken) {
            // return common.returnResult(false, 401, 'Refresh token is missing');
            return common.returnResult(false, 401, 'Session expired');
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(incomingRefreshToken);
        } catch (verifyErr) {
            // return common.returnResult(false, 401, 'Invalid or expired refresh token');
            return common.returnResult(false, 401, 'Session expired');
        }

        const incomingHash = hashToken(incomingRefreshToken);

        let session = await RefreshToken.findOne({
            userId: decoded.userId,
            tokenHash: incomingHash,
            isValid: true
        });
        const isCurrentToken = !!session;

        if (!session) {
            session = await RefreshToken.findOne({
                userId: decoded.userId,
                previousTokenHash: incomingHash,
                previousTokenExpiresAt: { $gt: new Date() },
                isValid: true
            });
        }

        if (!session) {
            return common.returnResult(false, 401, 'Session not found. Please login again');
        }

        if (session.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: session._id });
            return common.returnResult(false, 401, 'Session expired. Please login again');
        }

        const user = await User.findById(decoded.userId);
        if (!user || user.status === 'D') {
            await RefreshToken.deleteOne({ _id: session._id });
            return common.returnResult(false, 401, 'User not found or inactive');
        }

        // A request presenting the PREVIOUS token right after a rotation is racing that
        // rotation's own response: don't rotate again, or its cookie and ours would fight.
        const isRacingRotation = !isCurrentToken
            && session.rotatedAt
            && (Date.now() - session.rotatedAt.getTime()) < REFRESH_CONCURRENT_WINDOW_MS;

        let newRefreshToken = null;

        if (!isRacingRotation) {
            const candidateToken = generateRefreshToken({ userId: user._id });
            const candidateDecoded = verifyRefreshToken(candidateToken);

            // Guard = exactly the state we read above. If anything rotated in between, this
            // matches nothing and we lose the race.
            const guard = isCurrentToken
                ? { _id: session._id, tokenHash: incomingHash, isValid: true }
                : { _id: session._id, tokenHash: session.tokenHash, previousTokenHash: incomingHash, isValid: true };

            const now = new Date();
            const rotated = await RefreshToken.findOneAndUpdate(guard, {
                $set: {
                    tokenHash: hashToken(candidateToken),
                    // Rotating away from the current token -> it becomes the previous one.
                    // Re-rotating because the browser never adopted the last new token -> keep
                    // the token it DOES hold as the previous one; the last new token was lost.
                    previousTokenHash: isCurrentToken ? session.tokenHash : incomingHash,
                    previousTokenExpiresAt: new Date(now.getTime() + REFRESH_LOST_RESPONSE_GRACE_MS),
                    rotatedAt: now,
                    expiresAt: new Date(candidateDecoded.exp * 1000),
                    lastUsedAt: now,
                    userAgent: deviceMeta.userAgent,
                    ip: deviceMeta.ip
                }
            });

            if (rotated) {
                newRefreshToken = candidateToken;
            } else {
                // Lost the race (someone else rotated first) - or the session was just logged
                // out. Only the former may proceed.
                const stillThere = await RefreshToken.exists({ _id: session._id, isValid: true });
                if (!stillThere) {
                    return common.returnResult(false, 401, 'Session not found. Please login again');
                }
            }
        }

        const newAccessToken = generateAccessToken({
            userId: user._id,
            role: user.role,
            vendorId: user.vendorId
        });

        return common.returnResult(true, 200, 'Session renewed successfully', {
            accessToken: newAccessToken,
            // null when this request did not rotate - the controller must then leave the
            // browser's cookie alone.
            refreshToken: newRefreshToken,
            user: { _id: user._id, name: user.name, username: user.username, email: user.email, role: user.role }
        });
    } catch (err) {
        // Rotation is a single atomic update, so a failure here can never leave the session
        // half-rotated - no need to invalidate it (a transient DB error must not log the user out).
        throw err;
    }
};

const logoutUser = async (incomingRefreshToken) => {
    try {
        if (!incomingRefreshToken) {
            return common.returnResult(false, 400, 'No active session found');
        }

        const incomingHash = hashToken(incomingRefreshToken);
        await RefreshToken.deleteOne({ tokenHash: incomingHash });

        return common.returnResult(true, 200, `User Logged out successfully`);
    } catch (err) {
        throw err;
    }
};

const logoutAllDevices = async (incomingRefreshToken) => {
    try {
        if (!incomingRefreshToken) {
            return common.returnResult(false, 400, 'No active session found');
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(incomingRefreshToken);
        } catch (verifyErr) {
            return common.returnResult(false, 401, 'Invalid or expired refresh token');
        }

        await RefreshToken.deleteMany({ userId: decoded.userId });

        return common.returnResult(true, 200, `Logged out from all the devices`);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    logoutAllDevices,
    getUserCount
};