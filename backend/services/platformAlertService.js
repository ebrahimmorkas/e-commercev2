const nodemailerProvider = require('./emailProviders/nodemailerProvider');
const emailProviderConfig = require('../config/emailProviderConfig');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Emails to the PLATFORM OWNER (PLATFORM_OWNER_EMAIL in .env) - checkout
// problem reports now, error alerts later. Sent through the platform's own
// SMTP account (SMTP_* in .env), never a vendor's: these are about the
// platform, not the store, and must arrive even when the vendor's own email
// account is the thing that's broken.

const isConfigured = () => {
    try {
        const smtp = emailProviderConfig.nodemailer;
        return !!(process.env.PLATFORM_OWNER_EMAIL && smtp.host && smtp.user && smtp.pass);
    } catch (err) {
        throw err;
    }
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// rows: [[label, value], ...] -> a plain two-column table (empty values shown as "-").
const toHtmlTable = (rows) => `<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows
    .map(([label, value]) => `<tr><td style="border:1px solid #ddd;background:#f6f6f6;font-weight:bold;vertical-align:top">${escapeHtml(label)}</td><td style="border:1px solid #ddd">${escapeHtml(value || '-')}</td></tr>`)
    .join('')}</table>`;

const toText = (rows) => rows.map(([label, value]) => `${label}: ${value || '-'}`).join('\n');

/**
 * @param {Object} alert
 * @param {string} alert.subject
 * @param {string} alert.intro - one line above the details
 * @param {Array<[string, string]>} alert.rows - the details, label -> value
 * @returns {Promise<Object>} returnResult - 503 when the platform email isn't set up
 */
const sendToPlatformOwner = async ({ subject, intro, rows }) => {
    try {
        if (!isConfigured()) {
            logger.logWarning('Platform alert not sent - PLATFORM_OWNER_EMAIL or the platform SMTP account is not set up', {
                additionalData: { subject }
            });
            return common.returnResult(false, 503, 'The report could not be sent right now.');
        }
        const sendFailure = await nodemailerProvider.send({
            from: emailProviderConfig.nodemailer.user,
            to: process.env.PLATFORM_OWNER_EMAIL,
            subject,
            text: `${intro}\n\n${toText(rows)}`,
            html: `<p style="font-family:Arial,sans-serif;font-size:14px">${escapeHtml(intro)}</p>${toHtmlTable(rows)}`
        }).then(() => null).catch((sendErr) => {
            // The SMTP server refused / was unreachable - a result, not a crash.
            logger.logWarning('Platform alert could not be sent', { error: sendErr, additionalData: { subject } });
            return common.returnResult(false, 502, 'The report could not be sent right now.');
        });
        if (sendFailure) return sendFailure;
        logger.logInfo(1, 0, 'Platform alert sent', { subject });
        return common.returnResult(true, 200, 'Report sent');
    } catch (err) {
        throw err;
    }
};

module.exports = {
    isConfigured,
    sendToPlatformOwner
};
