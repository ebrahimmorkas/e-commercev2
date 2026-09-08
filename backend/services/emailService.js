const EmailLog = require('../models/EmailLog');
const CompanyMaster = require('../models/CompanyMaster');
const WebsiteMaster = require('../models/WebsiteMaster');
const CompanySettings = require('../models/CompanySettings');
const { getProvider } = require('./emailProviders/emailProviderFactory');
const common = require('../utils/common');
const logger = require('../utils/logger');

// A FAILED log stops being retried automatically after this many attempts -
// see retryFailedEmails.
const MAX_RETRY_ATTEMPTS = 3;

// Resolves which provider a vendor's email should be sent through right now.
// WebsiteMaster.mainEmailService set (non-null) always wins for EVERY vendor -
// lets an admin fail everyone over off a provider that's currently down.
// null = the vendor keeps using their own assigned CompanyMaster.emailService.
const resolveEmailProvider = (companyMasterData, websiteMasterData) => {
    if (websiteMasterData && websiteMasterData.mainEmailService) {
        return websiteMasterData.mainEmailService;
    }
    return (companyMasterData && companyMasterData.emailService) || null;
};

const normalizeList = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

const dedupeEmails = (list) => [...new Set(list.filter(Boolean).map(v => v.toLowerCase().trim()))];

// Very small {{token}} replacement for template content (EmailTemplateMaster
// subject/htmlBody/textBody). An unrecognized token is left as-is rather than
// replaced with an empty string, so a typo'd token shows up visibly wrong in
// the sent email instead of silently vanishing.
const renderTemplateString = (str, tokens = {}) => {
    if (!str) return str;
    return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
        return Object.prototype.hasOwnProperty.call(tokens, key) && tokens[key] != null ? String(tokens[key]) : match;
    });
};

const getFileExtension = (filename = '') => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

// What isEmbeddingLinksAllowed gates - a bare http(s):// URL anywhere in the
// text body, or an <a href="..."> in the html body.
const containsLinks = (content) => {
    if (!content) return false;
    return /https?:\/\//i.test(content) || /<a\s+[^>]*href\s*=/i.test(content);
};

// What isControlSelectionFeatureOn gates - the rich-text formatting controls
// (bold/italic/underline/strike/lists/headings/quote/font/inline style) a
// template/email composer's toolbar exposes. Plain <p>/<br>/<div> structure
// is NOT treated as "formatting" and stays allowed either way.
const CONTROL_TAG_PATTERN = /<(b|strong|i|em|u|s|strike|del|ul|ol|li|h[1-6]|blockquote|font)\b|style\s*=/i;
const containsFormattingControls = (html) => {
    if (!html) return false;
    return CONTROL_TAG_PATTERN.test(html);
};

// Shared by emailService.sendEmail() AND emailTemplateMasterService (template
// content is checked against these same rules at create/update time, not
// just at send time) - see the module comment in WebsiteMaster.js/CompanyMaster
// for why these aren't template-only.
const validateContentRules = ({ html, text, companyMasterData, websiteMasterData }) => {
    const linksAllowed = !!(websiteMasterData && websiteMasterData.isEmbeddingLinksAllowed) && !!(companyMasterData && companyMasterData.isEmbeddingLinksAllowed);
    if (!linksAllowed && (containsLinks(html) || containsLinks(text))) {
        return common.returnResult(false, 403, 'Embedding links in emails is not allowed for your account.');
    }

    const controlSelectionAllowed = !!(websiteMasterData && websiteMasterData.isControlSelectionFeatureOn) && !!(companyMasterData && companyMasterData.isControlSelectionFeatureOn);
    if (!controlSelectionAllowed && containsFormattingControls(html)) {
        return common.returnResult(false, 403, 'Rich text formatting is not allowed for your account.');
    }

    return common.returnResult(true, 200, 'Content rules satisfied');
};

// attachments: [{ filename, content: Buffer, mimeType, size (bytes) }]
const validateAttachments = (attachments, companyMasterData, websiteMasterData) => {
    if (!attachments || attachments.length === 0) {
        return common.returnResult(true, 200, 'No attachments');
    }

    const allowed = !!(websiteMasterData && websiteMasterData.isAddingOfAttachmentAllowed) && !!(companyMasterData && companyMasterData.isAddingOfAttachmentAllowed);
    if (!allowed) {
        return common.returnResult(false, 403, 'Attachments are not allowed for your account.');
    }

    const { numberOfAttachmentsAllowed, attachmentSizeAllowed, allowedAttachmentExtensions } = companyMasterData;

    if (numberOfAttachmentsAllowed != null && attachments.length > numberOfAttachmentsAllowed) {
        return common.returnResult(false, 400, `A maximum of ${numberOfAttachmentsAllowed} attachment(s) is allowed.`);
    }

    for (const file of attachments) {
        if (attachmentSizeAllowed != null && file.size != null && file.size > attachmentSizeAllowed * 1024 * 1024) {
            return common.returnResult(false, 400, `Attachment "${file.filename || ''}" exceeds the allowed size of ${attachmentSizeAllowed}MB.`);
        }
        if (allowedAttachmentExtensions && allowedAttachmentExtensions.length > 0 && file.filename) {
            const ext = getFileExtension(file.filename);
            if (!allowedAttachmentExtensions.map(e => e.toLowerCase()).includes(ext)) {
                return common.returnResult(false, 400, `Attachment extension ".${ext}" is not allowed.`);
            }
        }
    }

    return common.returnResult(true, 200, 'Attachments valid');
};

// images: [{ filename, content: Buffer, mimeType, size (bytes), cid }] - cid
// is required per image (the caller's html must already reference it as
// <img src="cid:THAT_CID">, since html is fully caller/template-rendered
// before sendEmail() is ever called).
const validateImages = (images, companyMasterData, websiteMasterData) => {
    if (!images || images.length === 0) {
        return common.returnResult(true, 200, 'No images');
    }

    const allowed = !!(websiteMasterData && websiteMasterData.isAddingOfImageAllowed) && !!(companyMasterData && companyMasterData.isAddingOfImageAllowed);
    if (!allowed) {
        return common.returnResult(false, 403, 'Images are not allowed for your account.');
    }

    const { numberOfImageAllowed, imageSizeAllowed, allowedImageExtensions } = companyMasterData;

    if (numberOfImageAllowed != null && images.length > numberOfImageAllowed) {
        return common.returnResult(false, 400, `A maximum of ${numberOfImageAllowed} image(s) is allowed.`);
    }

    for (const image of images) {
        if (!image.cid) {
            return common.returnResult(false, 400, `Image "${image.filename || ''}" is missing a cid to embed it in the body.`);
        }
        if (imageSizeAllowed != null && image.size != null && image.size > imageSizeAllowed * 1024 * 1024) {
            return common.returnResult(false, 400, `Image "${image.filename || ''}" exceeds the allowed size of ${imageSizeAllowed}MB.`);
        }
        if (allowedImageExtensions && allowedImageExtensions.length > 0 && image.filename) {
            const ext = getFileExtension(image.filename);
            if (!allowedImageExtensions.map(e => e.toLowerCase()).includes(ext)) {
                return common.returnResult(false, 400, `Image extension ".${ext}" is not allowed.`);
            }
        }
    }

    return common.returnResult(true, 200, 'Images valid');
};

// numberOfEmailsAllowed = lifetime cap, never resets, always enforced once set.
// numberOfEmailsAllowedPerMonth = optional additional throttle within that
// lifetime budget, resets every calendar month. Both null = unlimited.
const checkEmailQuota = async (vendorId, companyMasterData) => {
    try {
        const { numberOfEmailsAllowed, numberOfEmailsAllowedPerMonth } = companyMasterData;

        if (numberOfEmailsAllowed != null) {
            const totalSent = await EmailLog.countDocuments({ vendorId, sendStatus: 'SENT' });
            if (totalSent >= numberOfEmailsAllowed) {
                return common.returnResult(false, 403, 'You have reached the total number of emails allowed for your account.');
            }
        }

        if (numberOfEmailsAllowedPerMonth != null) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const sentThisMonth = await EmailLog.countDocuments({
                vendorId,
                sendStatus: 'SENT',
                createdAt: { $gte: startOfMonth }
            });
            if (sentThisMonth >= numberOfEmailsAllowedPerMonth) {
                return common.returnResult(false, 403, 'You have reached the number of emails allowed for this month.');
            }
        }

        return common.returnResult(true, 200, 'Within quota');
    } catch (err) {
        throw err;
    }
};

// Generic, module-agnostic email sender - any feature (order status changes,
// email verification, discount notices, announcements, etc.) calls this the
// same way. `module` is just a short caller identifier (e.g. 'order',
// 'authVerification') kept on EmailLog for bookkeeping - this function has no
// knowledge of what any specific module actually does.
//
// Caller passes vendorId/userId plus the already-cached companyMasterData/
// websiteMasterData/companySettingsData (from req, via ensureVendorDataCached) -
// this function never re-fetches them itself.
//
// isDefaultTemplate: pass true when the content being sent came from
// DefaultEmailTemplateMaster rather than the vendor's own tagged template
// (resolveTemplateForModule's `isDefault`). This skips validateContentRules
// (links/rich-formatting) - those rules exist to restrict what a VENDOR can
// put in front of their customers, not to gate the platform's own baseline
// fallback content. Attachment/image/quota/feature/cc-bcc checks still apply
// either way, since those are caller-supplied inputs and account-level
// limits, not template content.
const sendEmail = async ({
    vendorId,
    module,
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    attachments,
    images,
    userId,
    companyMasterData,
    websiteMasterData,
    companySettingsData,
    isDefaultTemplate = false
}) => {
    try {
        if (!module) {
            return common.returnResult(false, 400, 'module is required.');
        }
        if (!subject) {
            return common.returnResult(false, 400, 'subject is required.');
        }
        if (!text && !html) {
            return common.returnResult(false, 400, 'Either text or html body is required.');
        }

        const toList = dedupeEmails(normalizeList(to));
        if (toList.length === 0) {
            return common.returnResult(false, 400, 'At least one recipient email is required.');
        }

        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isSendingEmailFeatureOn', 'isSendingEmailFeatureOn');
        if (!featureCheck.isSuccess) {
            return featureCheck;
        }

        const quotaCheck = await checkEmailQuota(vendorId, companyMasterData);
        if (!quotaCheck.isSuccess) {
            return quotaCheck;
        }

        if (!isDefaultTemplate) {
            const contentCheck = validateContentRules({ html, text, companyMasterData, websiteMasterData });
            if (!contentCheck.isSuccess) {
                return contentCheck;
            }
        }

        const attachmentCheck = validateAttachments(attachments, companyMasterData, websiteMasterData);
        if (!attachmentCheck.isSuccess) {
            return attachmentCheck;
        }

        const imageCheck = validateImages(images, companyMasterData, websiteMasterData);
        if (!imageCheck.isSuccess) {
            return imageCheck;
        }

        const providerName = resolveEmailProvider(companyMasterData, websiteMasterData);
        if (!providerName) {
            return common.returnResult(false, 400, 'No email service configured for this vendor.');
        }

        // SES's Simple content type (see sesProvider.js) can't carry
        // attachments or inline images - fail clearly here instead of
        // silently dropping them.
        if (providerName === 'ses' && ((attachments && attachments.length) || (images && images.length))) {
            return common.returnResult(false, 400, 'The SES email provider does not support attachments or embedded images.');
        }

        const from = (companySettingsData && (companySettingsData.senderEmail || companySettingsData.adminEmail)) || null;
        if (!from) {
            return common.returnResult(false, 400, 'No sender email configured for this vendor.');
        }

        const ccList = dedupeEmails([...normalizeList(cc), ...normalizeList(companySettingsData && companySettingsData.ccList)]);
        const bccList = dedupeEmails([...normalizeList(bcc), ...normalizeList(companySettingsData && companySettingsData.bccList)]);

        if (ccList.length > 0 || bccList.length > 0) {
            const ccBccAllowed = !!(websiteMasterData && websiteMasterData.isCcAndBccFeatureOn) && !!(companyMasterData && companyMasterData.isCcAndBccFeatureOn);
            if (!ccBccAllowed) {
                return common.returnResult(false, 403, 'CC/BCC is not allowed for your account.');
            }
        }

        const provider = getProvider(providerName);

        // Images are just inline attachments (they carry a cid) as far as
        // the provider adapters are concerned - merge them in.
        const combinedAttachments = [...(attachments || []), ...(images || [])];

        // Written as FAILED before the send is attempted, then flipped to
        // SENT below only after the provider confirms delivery - see
        // EmailLog.sendStatus for why (house catch-block rules only allow
        // `throw err;` here, so a thrown provider error can't be caught to
        // update this record after the fact).
        const emailLog = await EmailLog.create({
            vendorId,
            module,
            provider: providerName,
            from,
            to: toList,
            cc: ccList,
            bcc: bccList,
            subject,
            html: html || null,
            text: text || null,
            isDefaultTemplate,
            sendStatus: 'FAILED',
            attachmentCount: (attachments || []).length,
            imageCount: (images || []).length,
            createdBy: userId
        });

        const result = await provider.send({
            from,
            to: toList,
            cc: ccList,
            bcc: bccList,
            subject,
            text,
            html,
            attachments: combinedAttachments
        });

        emailLog.sendStatus = 'SENT';
        emailLog.providerMessageId = result.messageId || null;
        await emailLog.save();

        logger.logInfo(1, 0, 'Email sent successfully', { vendorId, module, provider: providerName });

        return common.returnResult(true, 200, 'Email sent successfully', { emailLogId: emailLog._id, messageId: result.messageId });
    } catch (err) {
        throw err;
    }
};

// Finds recent FAILED sends and replays them through the normal sendEmail()
// pipeline - so a retry still respects whatever the CURRENT feature/quota/
// content rules are, not the rules at the moment of original failure. Skips
// anything that had attachments/images (never persisted on EmailLog, so
// there's nothing to actually replay - see the html/text comment on
// EmailLog.js) and anything already retried MAX_RETRY_ATTEMPTS times.
//
// Not wired to run automatically anywhere - call this from a script (see
// scripts/retryFailedEmails.js) on whatever schedule you decide (cron,
// node-cron, your host's scheduler, etc.). Deliberately not started as a
// background timer in server.js - that's a process-wide behavior change
// this function doesn't make on its own.
const retryFailedEmails = async ({ maxAgeMinutes = 60, limit = 50 } = {}) => {
    try {
        const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

        const failedLogs = await EmailLog.find({
            sendStatus: 'FAILED',
            retryCount: { $lt: MAX_RETRY_ATTEMPTS },
            retrySucceededLogId: null,
            createdAt: { $gte: cutoff },
            attachmentCount: 0,
            imageCount: 0
        }).limit(limit);

        const results = [];

        for (const failedLog of failedLogs) {
            const [companyMasterData, websiteMasterData, companySettingsData] = await Promise.all([
                CompanyMaster.findOne({ vendorId: failedLog.vendorId }),
                WebsiteMaster.findOne(),
                CompanySettings.findOne({ vendorId: failedLog.vendorId })
            ]);

            const retryResult = await sendEmail({
                vendorId: failedLog.vendorId,
                module: failedLog.module,
                to: failedLog.to,
                cc: failedLog.cc,
                bcc: failedLog.bcc,
                subject: failedLog.subject,
                html: failedLog.html,
                text: failedLog.text,
                userId: failedLog.createdBy,
                companyMasterData,
                websiteMasterData,
                companySettingsData,
                isDefaultTemplate: failedLog.isDefaultTemplate
            }).catch((err) => {
                logger.logException('Retry attempt threw while resending a failed email', { emailLogId: failedLog._id, err });
                return null;
            });

            failedLog.retryCount += 1;
            failedLog.lastRetryAt = new Date();
            if (retryResult && retryResult.isSuccess) {
                failedLog.retrySucceededLogId = retryResult.meta.emailLogId;
            }
            await failedLog.save();

            results.push({ emailLogId: failedLog._id, succeeded: !!(retryResult && retryResult.isSuccess) });
        }

        logger.logInfo(1, 0, 'Email retry pass completed', { attempted: results.length, succeeded: results.filter((r) => r.succeeded).length });
        return common.returnResult(true, 200, 'Retry pass completed', { results });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    resolveEmailProvider,
    checkEmailQuota,
    validateContentRules,
    validateAttachments,
    validateImages,
    renderTemplateString,
    sendEmail,
    retryFailedEmails
};
