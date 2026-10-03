const forgotPasswordService = require('../services/forgotPasswordService');
const { sendSuccess, sendError } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// Public - both login screens ask this to decide whether to show the
// "Forgot password?" link. Only this one feature's settings are exposed.
const getForgotPasswordConfig = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        if (!vendorId) {
            return sendError(res, 400, 'Vendor Identification failed');
        }

        const result = await forgotPasswordService.getForgotPasswordConfig(
            vendorId, req.websiteMasterData, req.companyMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return sendError(res, result.statusCode, result.message);
        }

        return sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (err) {
        logException('Error while fetching forgot password config', err);
    }
};

// Public - emails a reset code to the account. The answer is the same whether
// or not the email belongs to an account.
const requestPasswordResetOtp = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        if (!vendorId) {
            return sendError(res, 400, 'Vendor Identification failed');
        }

        const result = await forgotPasswordService.requestPasswordResetOtp({
            vendorId,
            email: req.body.email,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData
        });
        if (!result.isSuccess) {
            logInfo(0, 1, result.message);
            return sendError(res, result.statusCode, result.message);
        }

        logInfo(1, 0, 'Forgot password code requested', {});
        return sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (err) {
        logException('Error while requesting a password reset code', err);
    }
};

// Public - sets a new password using the emailed code.
const resetPassword = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        if (!vendorId) {
            return sendError(res, 400, 'Vendor Identification failed');
        }

        const { email, otp, newPassword } = req.body;
        const result = await forgotPasswordService.resetPasswordWithOtp({
            vendorId,
            email,
            otp,
            newPassword,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData
        });
        if (!result.isSuccess) {
            logInfo(0, 1, result.message);
            return sendError(res, result.statusCode, result.message);
        }

        logInfo(1, 0, 'Password reset with emailed code', { userId: result.meta.userId });
        return sendSuccess(res, result.statusCode, result.message);
    } catch (err) {
        logException('Error while resetting password', err);
    }
};

module.exports = {
    getForgotPasswordConfig,
    requestPasswordResetOtp,
    resetPassword
};
