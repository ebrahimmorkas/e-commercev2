const authService = require('../services/authService');
const { sendSuccess, sendError, checkFeatureOnOrOff } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');
const { accessTokenCookieOptions, refreshTokenCookieOptions, guestCartCookieOptions, knownUserIdCookieOptions } = require('../utils/cookieOptions');

const getDeviceMeta = (req) => ({
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection?.remoteAddress || 'unknown'
});

// TRN = Tax Registration Number: exactly 15 digits (UAE FTA format).
const TRN_PATTERN = /^\d{15}$/;
const BUSINESS_FULL_NAME_MAX_LENGTH = 100;

// Three gates, all must be on: the global WebsiteMaster flag, the vendor's
// CompanyMaster entitlement (both via checkFeatureOnOrOff, like every other
// feature), and the vendor's own opt-in in Company Settings. A vendor with no
// settings document yet has the feature off, same as an explicit false.
const isTaxRegistrationEnabled = async (req) => {
    const masterCheck = await checkFeatureOnOrOff(
        req.vendorId, req.websiteMasterData, req.companyMasterData,
        'isTaxRegistrationFeatureOn', 'isTaxRegistrationFeatureOn'
    );
    return masterCheck.isSuccess && req.companySettingsData?.isTaxRegistrationOnSignupEnabled === true;
};

// Public - the storefront register form asks this to decide whether to show the
// "I am tax registered" checkbox. Only the one boolean is exposed, never the
// rest of the vendor's settings.
const getRegistrationConfig = async (req, res) => {
    try {
        return sendSuccess(res, 200, 'Registration config fetched successfully', {
            taxRegistrationEnabled: await isTaxRegistrationEnabled(req)
        });
    } catch (err) {
        logException('Error while fetching registration config', err);
        return sendError(res, 500, 'Failed to fetch registration config');
    }
};

const register = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        if(!vendorId) {
            return sendError(res, 400, `Vendor Identification failed`);
        }
        const { name, username, email, phone_no, whatsapp_no, password, country, state, city, isTaxRegistered, businessFullName, trn } = req.body;

        if (!name || !username || !email || !phone_no || !password || !country || !state || !city) {
            logInfo(0, 1, 'Register failed - missing required fields', { username, email });
            return sendError(res, 400, 'name, username, email, phone_no, password, country, state and city are required');
        }

        // Tax registration details: only honoured when the vendor has the feature on
        // AND the customer ticked the box. Otherwise they're dropped, so a stale or
        // hand-crafted business name / TRN can never be stored against an untick.
        let taxDetails = { isTaxRegistered: false };
        if (isTaxRegistered === true && await isTaxRegistrationEnabled(req)) {
            const cleanBusinessName = typeof businessFullName === 'string' ? businessFullName.trim() : '';
            const cleanTrn = typeof trn === 'string' ? trn.trim() : '';
            if (!cleanBusinessName || !cleanTrn) {
                logInfo(0, 1, 'Register failed - tax registered without business name/TRN', { username, email });
                return sendError(res, 400, 'Business full name and TRN are required when registering as tax registered');
            }
            if (cleanBusinessName.length > BUSINESS_FULL_NAME_MAX_LENGTH) {
                return sendError(res, 400, `Business full name cannot exceed ${BUSINESS_FULL_NAME_MAX_LENGTH} characters`);
            }
            if (!TRN_PATTERN.test(cleanTrn)) {
                return sendError(res, 400, 'TRN must be exactly 15 digits');
            }
            taxDetails = { isTaxRegistered: true, businessFullName: cleanBusinessName, trn: cleanTrn };
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
            password,
            country,
            state,
            city,
            ...taxDetails
        });

        if(!newUser.isSuccess) {
            logInfo(0, 1, newUser.message);
            return sendError(res, newUser.statusCode, newUser.message);
        }

        logInfo(1, 0, newUser.message, { userId: newUser.meta.user._id });
        return sendSuccess(res, newUser.statusCode, newUser.message, newUser.meta.user);
    } catch (err) {
        logException('Error while registering user', err);
        // Must always respond - a catch that only logs leaves the client spinning.
        return sendError(res, 500, 'Registration failed. Please try again.');
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

        // Shoppers only - re-set on every login (never just once) so it
        // stays valid indefinitely and always points at the current account,
        // even across password changes/relogins. Admins never get this
        // cookie - it exists only to tag a later not-logged-in visit as
        // "possibly this known customer" for the abandoned-cart admin view.
        if (user.role === 'user') {
            res.cookie('knownUserId', user._id.toString(), knownUserIdCookieOptions);
        }

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

        const { accessToken, refreshToken: newRefreshToken, user } = result.meta;

        // newRefreshToken is null when this request didn't rotate (it lost a race against
        // another refresh with the same cookie) - the browser's cookie must then be left
        // alone, since the winning response is the one that carries the valid replacement.
        if (newRefreshToken) {
            res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions);
        }

        logInfo(1, 0, result.message, {});
        return sendSuccess(res, result.statusCode, result.message, { accessToken, user });
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
    getRegistrationConfig,
    login,
    refreshToken,
    logout,
    logoutAll
};