const authService = require('../services/authServie');
const { sendSuccess, sendError } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');
const { accessTokenCookieOptions, refreshTokenCookieOptions } = require('../utils/cookieOptions');

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

        const newUser = await authService.registerUser({
            vendorId,
            name,
            username,
            email,
            phone_no,
            whatsapp_no,
            password
        });

        logInfo(1, 0, 'User registered successfully', { userId: newUser._id });
        return sendSuccess(res, 201, 'User registered successfully', newUser);
    } catch (err) {
        logException('Error while registering user', err);
    }
};

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            logInfo(0, 1, 'Login failed - missing credentials', { identifier });
            return sendError(res, 400, 'identifier and password are required');
        }

        const deviceMeta = getDeviceMeta(req);
        const { accessToken, refreshToken, user } = await authService.loginUser({ identifier, password }, deviceMeta);

        res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

        logInfo(1, 0, 'User logged in successfully', { userId: user._id });
        return sendSuccess(res, 200, 'Login successful', { user, accessToken });
    } catch (err) {
        logException('Error while logging in user', err);
    }
};

const refreshToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken;
        const deviceMeta = getDeviceMeta(req);

        const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAccessToken(
            incomingRefreshToken,
            deviceMeta
        );

        res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions);

        logInfo(1, 0, 'Access token refreshed successfully', {});
        return sendSuccess(res, 200, 'Token refreshed successfully', { accessToken });
    } catch (err) {
        res.clearCookie('refreshToken', refreshTokenCookieOptions);
        logException('Error while refreshing access token', err);
    }
};

const logout = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken;
        await authService.logoutUser(incomingRefreshToken);

        res.clearCookie('refreshToken', refreshTokenCookieOptions);

        logInfo(1, 0, 'User logged out successfully', {});
        return sendSuccess(res, 200, 'Logout successful');
    } catch (err) {
        logException('Error while logging out user', err);
    }
};

const logoutAll = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken;
        await authService.logoutAllDevices(incomingRefreshToken);

        res.clearCookie('refreshToken', refreshTokenCookieOptions);

        logInfo(1, 0, 'User logged out from all devices successfully', {});
        return sendSuccess(res, 200, 'Logged out from all devices successfully');
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