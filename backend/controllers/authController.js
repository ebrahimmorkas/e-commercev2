const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');
const { accessTokenCookieOptions, refreshTokenCookieOptions, guestCartCookieOptions } = require('../utils/cookieOptions');

const getDeviceMeta = (req) => ({
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection?.remoteAddress || 'unknown'
});

const register = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        if(!vendorId) {
            return sendError(res, 400, `Vendor Identification failed`);
        }
        const { name, username, email, phone_no, whatsapp_no, password } = req.body;

        if (!name || !username || !email || !phone_no || !password) {
            logInfo(0, 1, 'Register failed - missing required fields', { username, email });
            return sendError(res, 400, 'name, username, email, phone_no and password are required');
        }

        const companyMasterData = req.companyMasterData;
        const { numberOfUsersAllowed } = companyMasterData;
        const countResult = await authService.getUserCount(vendorId);
        if (!countResult.isSuccess) {
            return sendError(res, countResult.statusCode, countResult.message);
        }
        if (countResult.meta.count >= numberOfUsersAllowed) {
            return sendError(res, 403, 'You have exceeded the number of users allowed');
        }

        const newUser = await authService.registerUser({
            vendorId,
            name,
            username,
            email,
            phone_no,
            whatsapp_no,
            password
        });

        if(!newUser.isSuccess) {
            logInfo(0, 1, newUser.message);
            return sendError(res, newUser.statusCode, newUser.message);
        }

        logInfo(1, 0, newUser.message, { userId: newUser.meta.user._id });
        return sendSuccess(res, newUser.statusCode, newUser.message, newUser.meta.user);
    } catch (err) {
        logException('Error while registering user', err);
    }
};

const login = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        if (!vendorId) {
            // Vendor detection fails
            return sendError(res, 400, 'nvalid credentials');
        }
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            logInfo(0, 1, 'Login failed - missing credentials', { identifier });
            return sendError(res, 400, 'identifier and password are required');
        }

                const deviceMeta = getDeviceMeta(req);
        const guestCartId = req.cookies?.guestCartId || null;
        const locationContext = {
            countryId: req.cookies?.Country || null,
            stateId: req.cookies?.State || null,
            cityId: req.cookies?.City || null,
            zipCode: req.cookies?.zip_code || null
        };

        const loginUser = await authService.loginUser(
            { identifier, password },
            deviceMeta,
            vendorId,
            guestCartId,
            locationContext,
            req.companyMasterData
        );

        if(!loginUser.isSuccess) {
            logInfo(0, 1, loginUser.message);
            return sendError(res, 400, loginUser.message);
        }

        const { accessToken, user } = loginUser.meta;

                res.cookie('refreshToken', loginUser.meta.refreshToken, refreshTokenCookieOptions);

        if (guestCartId && loginUser.meta.cartMerged) {
            res.clearCookie('guestCartId', guestCartCookieOptions);
        }

        logInfo(1, 0, 'User logged in successfully', { userId: user._id });
        return sendSuccess(res, loginUser.statusCode, loginUser.message, { user, accessToken });
    } catch (err) {
        logException('Error while logging in user', err);
    }
};

const refreshToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken;
        const deviceMeta = getDeviceMeta(req);

        const result = await authService.refreshAccessToken(incomingRefreshToken, deviceMeta);

        if(!result.isSuccess) {
            logInfo(0, 1, result.message);
            return sendError(res, result.statusCode, result.message);
        }

        const { accessToken, refreshToken: newRefreshToken } = result.meta;

        res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions);

        logInfo(1, 0, result.message, {});
        return sendSuccess(res, result.statusCode, result.message, { accessToken });
    } catch (err) {
        res.clearCookie('refreshToken', refreshTokenCookieOptions);
        logException('Error while refreshing access token', err);
    }
};

const logout = async (req, res) => {
    try {
const incomingRefreshToken = req.cookies?.refreshToken;
        const result = await authService.logoutUser(incomingRefreshToken);

        res.clearCookie('refreshToken', refreshTokenCookieOptions);

        if (!result.isSuccess) {
            logInfo(0, 1, result.message);
            return sendError(res, result.statusCode, result.message);
        }

        logInfo(1, 0, result.message, {});
        return sendSuccess(res, result.statusCode, result.message);
    } catch (err) {
        logException('Error while logging out user', err);
    }
};

const logoutAll = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken;
        const result = await authService.logoutAllDevices(incomingRefreshToken);

        res.clearCookie('refreshToken', refreshTokenCookieOptions);

        if (!result.isSuccess) {
            logInfo(0, 1, result.message);
            return sendError(res, result.statusCode, result.message);
        }

        logInfo(1, 0, result.message, {});
        return sendSuccess(res, result.statusCode, result.message);
    } catch (err) {
        logException('Error while logging out from all devices', err);
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    logout,
    logoutAll
};