const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const PasswordResetOtp = require('../models/PasswordResetOtp');
const EmailLog = require('../models/EmailLog');
const emailService = require('./emailService');
const vendorSmtpProvider = require('./emailProviders/vendorSmtpProvider');
const { hashToken } = require('../utils/token');
const common = require('../utils/common');
const logger = require('../utils/logger');
const {
    FORGOT_PASSWORD_EMAIL_MODULE,
    OTP_LENGTH,
    OTP_EXPIRY_MINUTES,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_MAX_REQUESTS_PER_WINDOW,
    OTP_REQUEST_WINDOW_MINUTES
} = require('../constants/forgotPasswordConstants');
require('dotenv').config({ quiet: true });

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);

const FEATURE_FLAG = 'isForgotPasswordFunctionalityOn';
const UNAVAILABLE_MESSAGE = 'Password reset is not available right now. Please contact the store.';
const INVALID_CODE_MESSAGE = 'The code is incorrect or has expired. Please request a new one.';
// Shown for every request, whether or not the email belongs to an account -
// otherwise this endpoint would tell anyone which emails are registered.
const CODE_SENT_MESSAGE = 'If an account exists for this email, a code has been sent to it.';

// Bound to the account, so a code can never be replayed against another user.
const hashOtp = (userId, otp) => {
    try {
        return hashToken(`${userId}:${otp}`);
    } catch (err) {
        throw err;
    }
};

const generateOtp = () => {
    try {
        return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    } catch (err) {
        throw err;
    }
};

const escapeHtml = (value) => {
    try {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    } catch (err) {
        throw err;
    }
};

const buildOtpEmail = ({ customerName, companyName, otp }) => {
    try {
        // Signed with the company name from Company Settings; a vendor that
        // hasn't filled it in gets no sign-off rather than a made-up name.
        const storeName = (companyName || '').trim();
        const subject = storeName ? `Your ${storeName} password reset code` : 'Your password reset code';
        const text = [
            `Hello ${customerName},`,
            '',
            `Your password reset code is ${otp}`,
            `It is valid for ${OTP_EXPIRY_MINUTES} minutes and can be used once.`,
            '',
            'If you did not ask to reset your password, you can ignore this email - your password stays the same.',
            ...(storeName ? ['', storeName] : [])
        ].join('\n');
        const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">`
            + `<p>Hello ${escapeHtml(customerName)},</p>`
            + `<p>Your password reset code is</p>`
            + `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${escapeHtml(otp)}</p>`
            + `<p>It is valid for ${OTP_EXPIRY_MINUTES} minutes and can be used once.</p>`
            + `<p>If you did not ask to reset your password, you can ignore this email - your password stays the same.</p>`
            + (storeName ? `<p>${escapeHtml(storeName)}</p>` : '')
            + `</div>`;
        return { subject, text, html };
    } catch (err) {
        throw err;
    }
};

// The feature switch alone - enough to accept a code that was already emailed.
const checkForgotPasswordFeature = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        if (!websiteMasterData || !companyMasterData) {
            return common.returnResult(false, 403, UNAVAILABLE_MESSAGE);
        }
        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, FEATURE_FLAG, FEATURE_FLAG);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message || UNAVAILABLE_MESSAGE);
        }
        return common.returnResult(true, 200, 'Forgot password is on');
    } catch (err) {
        throw err;
    }
};

// The feature switch AND a working way to email the code. Both login screens
// ask this (getForgotPasswordConfig) so the "Forgot password?" link is only
// offered when a code can actually be delivered.
const checkForgotPasswordAvailability = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const featureCheck = await checkForgotPasswordFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return featureCheck;
        }

        const emailCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isSendingEmailFeatureOn', 'isSendingEmailFeatureOn');
        if (!emailCheck.isSuccess || !vendorSmtpProvider.isAccountReady(companySettingsData && companySettingsData.emailAccount)) {
            return common.returnResult(false, 403, UNAVAILABLE_MESSAGE);
        }

        return common.returnResult(true, 200, 'Forgot password is available');
    } catch (err) {
        throw err;
    }
};

const getForgotPasswordConfig = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const availability = await checkForgotPasswordAvailability(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        return common.returnResult(true, 200, 'Forgot password config fetched successfully', {
            forgotPasswordEnabled: availability.isSuccess,
            otpLength: OTP_LENGTH,
            otpExpiryMinutes: OTP_EXPIRY_MINUTES,
            resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS
        });
    } catch (err) {
        throw err;
    }
};

// Only an active account with its own password can be reset: a deleted or
// inactive account can't sign in anyway, and a Google account has no password.
const findResettableUser = async (vendorId, email) => {
    try {
        return await User.findOne({ vendorId, email, status: 'A', authProvider: 'local', password: { $ne: null } });
    } catch (err) {
        throw err;
    }
};

// The code must not stay readable in EmailLog (which keeps every email's body),
// and a send that failed must not be replayed later by retryFailedEmails - by
// then the code is dead.
const scrubOtpFromEmailLogs = async (vendorId, email, since, redactedEmail) => {
    try {
        await EmailLog.updateMany(
            { vendorId, module: FORGOT_PASSWORD_EMAIL_MODULE, to: email, createdAt: { $gte: since } },
            { $set: { html: redactedEmail.html, text: redactedEmail.text, retryCount: emailService.MAX_RETRY_ATTEMPTS } }
        );
    } catch (err) {
        throw err;
    }
};

const requestPasswordResetOtp = async ({ vendorId, email, websiteMasterData, companyMasterData, companySettingsData }) => {
    try {
        const availability = await checkForgotPasswordAvailability(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        if (!availability.isSuccess) {
            return availability;
        }

        const codeSentResult = common.returnResult(true, 200, CODE_SENT_MESSAGE, {
            otpExpiryMinutes: OTP_EXPIRY_MINUTES,
            resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS
        });

        const user = await findResettableUser(vendorId, email);
        if (!user) {
            return codeSentResult;
        }

        // Request limits. Hitting one answers exactly like a sent code, for
        // the same reason an unknown email does.
        const startedAt = new Date();
        const windowStart = new Date(startedAt.getTime() - OTP_REQUEST_WINDOW_MINUTES * 60 * 1000);
        const recentRequests = await PasswordResetOtp.find({ vendorId, userId: user._id, createdAt: { $gte: windowStart } })
            .sort({ createdAt: -1 })
            .select('createdAt')
            .lean();
        const isCoolingDown = recentRequests.length > 0
            && (startedAt.getTime() - new Date(recentRequests[0].createdAt).getTime()) < OTP_RESEND_COOLDOWN_SECONDS * 1000;
        if (recentRequests.length >= OTP_MAX_REQUESTS_PER_WINDOW || isCoolingDown) {
            logger.logInfo(0, 1, 'Forgot password - code request limit reached', { userId: user._id });
            return codeSentResult;
        }

        // Only the newest code works.
        await PasswordResetOtp.updateMany(
            { vendorId, userId: user._id, status: 'A' },
            { $set: { status: 'D', deletedBy: user._id } }
        );

        const otp = generateOtp();
        const otpRecord = await PasswordResetOtp.create({
            vendorId,
            userId: user._id,
            otpHash: hashOtp(user._id, otp),
            expiresAt: new Date(startedAt.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000),
            createdBy: user._id
        });

        const companyName = companySettingsData && companySettingsData.companyName;
        const otpEmail = buildOtpEmail({ customerName: user.name, companyName, otp });

        // The company's CC/BCC lists are left out - the code is for the
        // account owner alone. A send that throws must not fail the request
        // (that would also reveal the account exists), so it is caught here.
        const sendResult = await emailService.sendEmail({
            vendorId,
            module: FORGOT_PASSWORD_EMAIL_MODULE,
            to: user.email,
            subject: otpEmail.subject,
            text: otpEmail.text,
            html: otpEmail.html,
            userId: user._id,
            companyMasterData,
            websiteMasterData,
            companySettingsData,
            isDefaultTemplate: true,
            includeCompanyCc: false,
            includeCompanyBcc: false
        }).catch((sendErr) => {
            logger.logWarning('Forgot password - sending the code email threw', { userId: user._id, sendErr });
            return null;
        });

        const redactedEmail = buildOtpEmail({ customerName: user.name, companyName, otp: '*'.repeat(OTP_LENGTH) });
        await scrubOtpFromEmailLogs(vendorId, user.email, startedAt, redactedEmail);

        if (!sendResult || !sendResult.isSuccess) {
            // Nothing reached the customer - drop the code so this attempt
            // doesn't count against their request limit.
            await PasswordResetOtp.deleteOne({ _id: otpRecord._id });
            logger.logWarning('Forgot password - the code email could not be sent', {
                userId: user._id,
                reason: sendResult ? sendResult.message : 'send threw'
            });
        }

        return codeSentResult;
    } catch (err) {
        throw err;
    }
};

const resetPasswordWithOtp = async ({ vendorId, email, otp, newPassword, websiteMasterData, companyMasterData }) => {
    try {
        const featureCheck = await checkForgotPasswordFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return featureCheck;
        }

        const user = await findResettableUser(vendorId, email);
        if (!user) {
            return common.returnResult(false, 400, INVALID_CODE_MESSAGE);
        }

        // The attempt is counted in the same atomic step that fetches the code,
        // BEFORE it is compared - concurrent guesses can't get past the limit.
        const otpRecord = await PasswordResetOtp.findOneAndUpdate(
            {
                vendorId,
                userId: user._id,
                status: 'A',
                usedAt: null,
                expiresAt: { $gt: new Date() },
                attempts: { $lt: OTP_MAX_ATTEMPTS }
            },
            { $inc: { attempts: 1 } },
            { returnDocument: 'after', sort: { createdAt: -1 } }
        );
        if (!otpRecord) {
            return common.returnResult(false, 400, INVALID_CODE_MESSAGE);
        }

        const expectedHash = Buffer.from(otpRecord.otpHash);
        const givenHash = Buffer.from(hashOtp(user._id, otp));
        if (expectedHash.length !== givenHash.length || !crypto.timingSafeEqual(expectedHash, givenHash)) {
            const attemptsLeft = OTP_MAX_ATTEMPTS - otpRecord.attempts;
            return common.returnResult(false, 400, attemptsLeft > 0
                ? `The code is incorrect. You have ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`
                : 'Too many incorrect attempts. Please request a new code.');
        }

        const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
        if (isSameAsCurrent) {
            // The code was right, so this try is given back.
            await PasswordResetOtp.updateOne({ _id: otpRecord._id }, { $inc: { attempts: -1 } });
            return common.returnResult(false, 400, 'New password must be different from your current password.');
        }

        // A code works once: of two identical submissions only one gets past here.
        const consumed = await PasswordResetOtp.findOneAndUpdate(
            { _id: otpRecord._id, status: 'A', usedAt: null },
            { $set: { usedAt: new Date(), updatedBy: user._id } }
        );
        if (!consumed) {
            return common.returnResult(false, 400, INVALID_CODE_MESSAGE);
        }

        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await User.updateOne({ _id: user._id, vendorId }, { $set: { password: hashedPassword, updated_by: user._id } });

        // Whoever knew the old password is signed out everywhere.
        await RefreshToken.deleteMany({ userId: user._id });

        return common.returnResult(true, 200, 'Password reset successfully. Please sign in with your new password.', { userId: user._id });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getForgotPasswordConfig,
    requestPasswordResetOtp,
    resetPasswordWithOtp
};
