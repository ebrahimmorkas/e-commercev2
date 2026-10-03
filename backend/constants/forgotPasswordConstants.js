// Tunables for the forgot-password flow (forgotPasswordService.js). The
// storefront/admin screens read the minutes/seconds from the API responses
// rather than hardcoding them, so changing a value here is enough.

// EmailLog.module for the code email. Not an EMAIL_MODULES key on purpose:
// this is a fixed built-in email, not a vendor-editable template.
const FORGOT_PASSWORD_EMAIL_MODULE = 'forgotPassword';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
// Wrong codes allowed against one emailed code before it stops working.
const OTP_MAX_ATTEMPTS = 5;
// A new code can't be requested for the same account sooner than this...
const OTP_RESEND_COOLDOWN_SECONDS = 60;
// ...and no more than this many per rolling window.
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_REQUEST_WINDOW_MINUTES = 60;
// How long a code's record is kept after it expires (TTL index). Must stay
// longer than OTP_REQUEST_WINDOW_MINUTES, since the request limit counts them.
const OTP_RECORD_RETENTION_SECONDS = 24 * 60 * 60;

module.exports = {
    FORGOT_PASSWORD_EMAIL_MODULE,
    OTP_LENGTH,
    OTP_EXPIRY_MINUTES,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_MAX_REQUESTS_PER_WINDOW,
    OTP_REQUEST_WINDOW_MINUTES,
    OTP_RECORD_RETENTION_SECONDS
};
