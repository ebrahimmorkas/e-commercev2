const mongoose = require('mongoose');
const SentEmail = require('../models/SentEmail');
const User = require('../models/User');
const Group = require('../models/Group');
const FileAsset = require('../models/FileAsset');
const ImageAsset = require('../models/ImageAsset');
const EmailTemplateMaster = require('../models/EmailTemplateMaster');
const emailService = require('./emailService');
const fileUploadService = require('./fileUploadService');
const imageUploadService = require('./imageUploadService');
const { readStoredAsset } = require('./storedFileReader');
const logger = require('../utils/logger');
const common = require('../utils/common');

/*
|--------------------------------------------------------------------------
| SEND EMAIL MODULE
|--------------------------------------------------------------------------
| The vendor composes an email and sends it to store customers (picked one
| by one, by user group, or all of them) and - when
| isSendingEmailToUsersOutOfStoreAllowed is on - to typed-in addresses.
| Every recipient gets their own separate email. Gated by the master
| isSendingEmailFeatureOn AND isSendEmailModuleOn (WebsiteMaster AND
| CompanyMaster).
|
| Attachments/images: Company Settings library files the vendor ticks plus
| files uploaded just for this email, together within the Send Email limits
| (CompanyMaster ...InSendEmail). Uploaded files are deleted after
| WebsiteMaster.sendEmailFileRetentionDays (see sentEmailCleanupService).
|
| The send itself runs in the background after the request is answered; the
| SentEmail record tracks each recipient, and sending stops (remaining
| recipients SKIPPED) if the email quota or the email feature stops it.
*/

const SEND_EMAIL_MODULE = 'sendEmail';
const UPLOAD_ATTACHMENT_MODULE = 'sendEmailAttachment';
const UPLOAD_IMAGE_MODULE = 'sendEmailImage';
const IMAGE_TOKEN = /\{\{\s*image:([a-z0-9_-]+)\s*\}\}/gi;
const IMAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// {{variables}} a Send Email body/subject may use (filled per recipient).
const SEND_EMAIL_VARIABLES = [
    { key: 'customerName', description: "The recipient's name (blank for an address that isn't a store customer)" },
    { key: 'customerEmail', description: "The recipient's email address" },
    { key: 'companyName', description: 'Your company name (Company Settings)' }
];

const isBothOn = (flag, websiteMasterData, companyMasterData) => {
    try {
        return websiteMasterData?.[flag] === true && companyMasterData?.[flag] === true;
    } catch (err) {
        throw err;
    }
};

// What the Send Email page may offer, and its limits.
const getSendEmailAccess = (companyMasterData, websiteMasterData) => {
    try {
        return {
            isOn: isBothOn('isSendingEmailFeatureOn', websiteMasterData, companyMasterData)
                && isBothOn('isSendEmailModuleOn', websiteMasterData, companyMasterData),
            canEmailOutOfStore: isBothOn('isSendingEmailToUsersOutOfStoreAllowed', websiteMasterData, companyMasterData),
            isCcAndBccOn: isBothOn('isCcAndBccFeatureOn', websiteMasterData, companyMasterData),
            attachments: {
                isOn: isBothOn('isAddingOfAttachmentAllowed', websiteMasterData, companyMasterData),
                maxCount: companyMasterData?.numberOfAttachmentsAllowedInSendEmail ?? null,
                maxSizeMB: companyMasterData?.attachmentSizeAllowedInSendEmail ?? null,
                allowedExtensions: companyMasterData?.allowedAttachmentExtensions || []
            },
            images: {
                isOn: isBothOn('isAddingOfImageAllowed', websiteMasterData, companyMasterData),
                maxCount: companyMasterData?.numberOfImagesAllowedInSendEmail ?? null,
                maxSizeMB: companyMasterData?.imageSizeAllowedInSendEmail ?? null,
                allowedExtensions: companyMasterData?.allowedImageExtensions || []
            },
            fileRetentionDays: websiteMasterData?.sendEmailFileRetentionDays ?? 90
        };
    } catch (err) {
        throw err;
    }
};

const checkSendEmailOn = (companyMasterData, websiteMasterData) => {
    try {
        if (!getSendEmailAccess(companyMasterData, websiteMasterData).isOn) {
            return common.returnResult(false, 403, 'Sending emails is not available for your account.');
        }
        return common.returnResult(true, 200, 'Send Email is on');
    } catch (err) {
        throw err;
    }
};

// Everything the compose form needs: access/limits, the Company Settings
// library, user groups, templates to start from, and the variables.
const fetchSendEmailOptions = async (vendorId, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const gate = checkSendEmailOn(companyMasterData, websiteMasterData);
        if (!gate.isSuccess) return gate;

        const [groups, templates, customerCount] = await Promise.all([
            Group.find({ vendorId, groupType: 'USER', status: 'A' }).select('groupName membersCount').sort({ groupName: 1 }).lean(),
            EmailTemplateMaster.find({ vendorId, status: 'A' }).select('templateName subject htmlBody textBody').sort({ templateName: 1 }).lean(),
            User.countDocuments({ vendorId, role: 'user', status: 'A', email: { $nin: [null, ''] } })
        ]);

        const emailAccount = companySettingsData?.emailAccount;
        return common.returnResult(true, 200, 'Send Email options fetched successfully', {
            access: getSendEmailAccess(companyMasterData, websiteMasterData),
            // No own email account = nothing can be sent (Company Settings > Email).
            hasEmailAccount: !!(emailAccount && emailAccount.host && emailAccount.encryptedPassword),
            libraryAttachments: (companySettingsData?.emailAttachments || []).map((a) => ({
                _id: a._id, displayName: a.displayName || a.originalName, size: a.size, mimeType: a.mimeType
            })),
            libraryImages: (companySettingsData?.emailImages || []).map((img) => ({ _id: img._id, name: img.name, url: img.url })),
            groups: groups.map((g) => ({ _id: g._id, groupName: g.groupName, membersCount: g.membersCount || 0 })),
            templates,
            customerCount,
            variables: SEND_EMAIL_VARIABLES
        });
    } catch (err) {
        throw err;
    }
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Store customers (with an email) matching name / email / phone.
const searchCustomers = async (vendorId, query, companyMasterData, websiteMasterData) => {
    try {
        const gate = checkSendEmailOn(companyMasterData, websiteMasterData);
        if (!gate.isSuccess) return gate;

        const filter = { vendorId, role: 'user', status: 'A', email: { $nin: [null, ''] } };
        const q = String(query || '').trim();
        if (q) {
            const pattern = new RegExp(escapeRegex(q), 'i');
            filter.$or = [{ name: pattern }, { email: pattern }, { phone_no: pattern }];
        }
        const customers = await User.find(filter).select('name email phone_no').sort({ name: 1 }).limit(20).lean();
        return common.returnResult(true, 200, 'Customers fetched successfully', { customers });
    } catch (err) {
        throw err;
    }
};

// Everyone the email goes to, one entry per address.
const resolveRecipients = async (vendorId, { customerIds = [], groupIds = [], allCustomers = false, externalEmails = [] }) => {
    try {
        const customerFilter = { vendorId, role: 'user', status: 'A', email: { $nin: [null, ''] } };
        let customers = [];
        let groupNames = [];

        if (allCustomers) {
            customers = await User.find(customerFilter).select('name email').lean();
        } else {
            const groups = groupIds.length
                ? await Group.find({ _id: { $in: groupIds }, vendorId, groupType: 'USER', status: 'A' }).select('groupName members').lean()
                : [];
            groupNames = groups.map((g) => g.groupName);
            const ids = [...new Set([...customerIds, ...groups.flatMap((g) => g.members || [])].map(String))];
            customers = ids.length ? await User.find({ ...customerFilter, _id: { $in: ids } }).select('name email').lean() : [];
        }

        const byEmail = new Map();
        customers.forEach((c) => byEmail.set(c.email.toLowerCase(), { userId: c._id, email: c.email.toLowerCase(), name: c.name || '' }));

        // A typed address that belongs to a store customer is that customer.
        const typed = [...new Set(externalEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
        const typedLeft = typed.filter((email) => !byEmail.has(email));
        if (typedLeft.length) {
            const known = await User.find({ ...customerFilter, email: { $in: typedLeft } }).select('name email').lean();
            known.forEach((c) => byEmail.set(c.email.toLowerCase(), { userId: c._id, email: c.email.toLowerCase(), name: c.name || '' }));
        }
        const outsiders = typed.filter((email) => !byEmail.has(email));
        outsiders.forEach((email) => byEmail.set(email, { userId: null, email, name: '' }));

        return { recipients: [...byEmail.values()], groupNames, outsiders };
    } catch (err) {
        throw err;
    }
};

const imageNamesIn = (html) => {
    try {
        const names = new Set();
        String(html || '').replace(IMAGE_TOKEN, (match, name) => { names.add(name.toLowerCase()); return match; });
        return [...names];
    } catch (err) {
        throw err;
    }
};

// Removes files uploaded during a send that then failed to go ahead.
const discardUploads = async (vendorId, userId, uploaded) => {
    try {
        for (const item of uploaded) {
            if (item.fileAssetId) await fileUploadService.deleteFile({ vendorId, fileId: item.fileAssetId, userId }).catch(() => null);
            if (item.imageAssetId) await imageUploadService.deleteImage({ imageId: item.imageAssetId, userId }).catch(() => null);
        }
    } catch (err) {
        throw err;
    }
};

/**
 * Validates and records a Send Email email, then sends it in the background.
 * payload: { subject, htmlBody, textBody, customerIds, groupIds, allCustomers,
 *   externalEmails, includeCompanyCcList, includeCompanyBccList, ccList,
 *   bccList, attachmentIds, imageIds (library entry ids), uploadImageNames }
 * files: { attachments: [multer file], images: [multer file] } - images[i]
 *   is named uploadImageNames[i].
 */
const sendComposedEmail = async (vendorId, adminUser, payload, files, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const gate = checkSendEmailOn(companyMasterData, websiteMasterData);
        if (!gate.isSuccess) return gate;
        const access = getSendEmailAccess(companyMasterData, websiteMasterData);

        const externalEmails = payload.externalEmails || [];
        if (externalEmails.length > 0 && !access.canEmailOutOfStore) {
            // Typed addresses are still fine when they belong to store customers.
            const { outsiders } = await resolveRecipients(vendorId, { externalEmails });
            if (outsiders.length) {
                return common.returnResult(false, 403, `You can only email customers of your store. Not a customer: ${outsiders.slice(0, 5).join(', ')}${outsiders.length > 5 ? '…' : ''}.`);
            }
        }
        const invalidTyped = externalEmails.find((e) => !EMAIL_PATTERN.test(String(e).trim()));
        if (invalidTyped) {
            return common.returnResult(false, 400, `"${invalidTyped}" is not a valid email address.`);
        }

        const { recipients, groupNames } = await resolveRecipients(vendorId, {
            customerIds: payload.customerIds || [],
            groupIds: payload.groupIds || [],
            allCustomers: payload.allCustomers === true,
            externalEmails
        });
        if (recipients.length === 0) {
            return common.returnResult(false, 400, 'There is nobody to send this email to. Pick customers (with an email address) or type an address.');
        }

        const ccList = payload.ccList || [];
        const bccList = payload.bccList || [];
        if (!access.isCcAndBccOn && (ccList.length || bccList.length)) {
            return common.returnResult(false, 403, 'CC/BCC is not allowed for your account.');
        }

        const contentCheck = emailService.validateContentRules({ html: payload.htmlBody, text: payload.textBody, companyMasterData, websiteMasterData });
        if (!contentCheck.isSuccess) return contentCheck;

        // --- attachments / images: library picks + uploads, within the Send Email limits
        const uploadAttachments = files?.attachments || [];
        const uploadImages = files?.images || [];
        const pickedAttachments = (companySettingsData?.emailAttachments || []).filter((a) => (payload.attachmentIds || []).map(String).includes(String(a._id)));
        const pickedImages = (companySettingsData?.emailImages || []).filter((img) => (payload.imageIds || []).map(String).includes(String(img._id)));
        if ((payload.attachmentIds || []).length !== pickedAttachments.length || (payload.imageIds || []).length !== pickedImages.length) {
            return common.returnResult(false, 400, 'One of the selected Company Settings files no longer exists. Please refresh the page and try again.');
        }

        const attachmentTotal = pickedAttachments.length + uploadAttachments.length;
        if (attachmentTotal > 0 && !access.attachments.isOn) {
            return common.returnResult(false, 403, 'Attachments are not allowed for your account.');
        }
        if (access.attachments.maxCount != null && attachmentTotal > access.attachments.maxCount) {
            return common.returnResult(false, 400, `An email can have at most ${access.attachments.maxCount} attachment(s). You added ${attachmentTotal}.`);
        }

        const imageTotal = pickedImages.length + uploadImages.length;
        if (imageTotal > 0 && !access.images.isOn) {
            return common.returnResult(false, 403, 'Images are not allowed for your account.');
        }
        if (access.images.maxCount != null && imageTotal > access.images.maxCount) {
            return common.returnResult(false, 400, `An email can have at most ${access.images.maxCount} image(s). You added ${imageTotal}.`);
        }

        const uploadImageNames = (payload.uploadImageNames || []).map((n) => String(n).trim().toLowerCase());
        if (uploadImageNames.length !== uploadImages.length) {
            return common.returnResult(false, 400, 'Every uploaded image needs a name.');
        }
        const allImageNames = [...pickedImages.map((img) => img.name), ...uploadImageNames];
        const badName = uploadImageNames.find((n) => !IMAGE_NAME_PATTERN.test(n));
        if (badName !== undefined) {
            return common.returnResult(false, 400, `Image name "${badName}" may only use 2-40 lowercase letters, numbers, - and _, starting with a letter or number.`);
        }
        if (new Set(allImageNames).size !== allImageNames.length) {
            return common.returnResult(false, 400, 'Two images have the same name. Please give each image its own name.');
        }
        const missingImages = imageNamesIn(payload.htmlBody).filter((n) => !allImageNames.includes(n));
        if (missingImages.length) {
            return common.returnResult(false, 400, `The body uses ${missingImages.map((n) => `{{image:${n}}}`).join(', ')}, but no image with that name was selected or uploaded.`);
        }

        // Uploads (each re-checked for size, extension and real content).
        const uploaded = [];
        const attachmentRecords = pickedAttachments.map((a) => ({
            source: 'LIBRARY', fileAssetId: a.fileAssetId, name: a.displayName || a.originalName, url: a.url, mimeType: a.mimeType, size: a.size
        }));
        for (const file of uploadAttachments) {
            const result = await fileUploadService.uploadFile({
                vendorId, module: UPLOAD_ATTACHMENT_MODULE, file, userId: adminUser._id,
                maxSizeField: 'attachmentSizeAllowedInSendEmail', allowedFormatsField: 'allowedAttachmentExtensions', companyMasterData, websiteMasterData
            });
            if (!result.isSuccess) {
                await discardUploads(vendorId, adminUser._id, uploaded);
                return common.returnResult(false, result.statusCode, `${file.originalname}: ${result.message}`);
            }
            const asset = result.meta.file;
            uploaded.push({ fileAssetId: asset._id });
            attachmentRecords.push({ source: 'UPLOAD', fileAssetId: asset._id, name: asset.originalName, url: asset.url, mimeType: asset.mimeType, size: asset.size });
        }

        const imageRecords = pickedImages.map((img) => ({
            source: 'LIBRARY', imageAssetId: img.imageAssetId, name: img.name, url: img.url, mimeType: img.mimeType, size: img.size
        }));
        for (let i = 0; i < uploadImages.length; i++) {
            const file = uploadImages[i];
            const result = await imageUploadService.uploadImage({
                vendorId, module: UPLOAD_IMAGE_MODULE, file, userId: adminUser._id,
                maxSizeField: 'imageSizeAllowedInSendEmail', allowedFormatsField: 'allowedImageExtensions', companyMasterData, websiteMasterData
            });
            if (!result.isSuccess) {
                await discardUploads(vendorId, adminUser._id, uploaded);
                return common.returnResult(false, result.statusCode, `${file.originalname}: ${result.message}`);
            }
            const asset = result.meta.image;
            uploaded.push({ imageAssetId: asset._id });
            imageRecords.push({ source: 'UPLOAD', imageAssetId: asset._id, name: uploadImageNames[i], url: asset.url, mimeType: asset.mimeType, size: asset.size });
        }

        const sentEmail = await SentEmail.create({
            vendorId,
            subject: payload.subject,
            htmlBody: payload.htmlBody,
            textBody: payload.textBody || null,
            recipientSelection: {
                allCustomers: payload.allCustomers === true,
                customerCount: (payload.customerIds || []).length,
                groupNames,
                externalEmailCount: externalEmails.length
            },
            recipients,
            includeCompanyCcList: payload.includeCompanyCcList !== false,
            includeCompanyBccList: payload.includeCompanyBccList !== false,
            ccList,
            bccList,
            attachments: attachmentRecords,
            images: imageRecords,
            sendStatus: 'SENDING',
            sentByName: adminUser.name || '',
            createdBy: adminUser._id
        });

        // Answer now; deliver in the background (a promise-level catch - it only logs).
        setImmediate(() => {
            deliver(sentEmail._id, companyMasterData, websiteMasterData, companySettingsData).catch((err) => {
                logger.logWarning('Send Email - background delivery failed', { vendorId, sentEmailId: sentEmail._id, err });
            });
        });

        logger.logInfo(1, 0, 'Send Email queued', { vendorId, sentEmailId: sentEmail._id, recipients: recipients.length });
        return common.returnResult(true, 202, `Sending to ${recipients.length} recipient(s). You can follow it in the history.`, { sentEmail });
    } catch (err) {
        throw err;
    }
};

// Sends the recorded email to each recipient in turn, updating the history.
const deliver = async (sentEmailId, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const sentEmail = await SentEmail.findById(sentEmailId).lean();
        if (!sentEmail) return;
        const vendorId = sentEmail.vendorId;

        // Files are read once for all recipients; an unreadable one is left out.
        const attachments = [];
        const fileAssets = await FileAsset.find({ _id: { $in: sentEmail.attachments.map((a) => a.fileAssetId) }, vendorId }).lean();
        for (const record of sentEmail.attachments) {
            const asset = fileAssets.find((f) => String(f._id) === String(record.fileAssetId));
            if (!asset) continue;
            try {
                const content = await readStoredAsset(asset);
                const extension = asset.extension ? `.${asset.extension}` : '';
                let filename = record.name || asset.originalName;
                if (extension && !filename.toLowerCase().endsWith(extension)) filename += extension;
                attachments.push({ filename, content, mimeType: asset.mimeType, size: content.length });
            } catch (readErr) {
                logger.logWarning('Send Email - attachment could not be read, sending without it', { vendorId, fileAssetId: asset._id, err: readErr });
            }
        }

        const images = [];
        const cidByName = {};
        const imageAssets = await ImageAsset.find({ _id: { $in: sentEmail.images.map((img) => img.imageAssetId) }, vendorId }).lean();
        const usedNames = imageNamesIn(sentEmail.htmlBody);
        for (const record of sentEmail.images) {
            if (!usedNames.includes(record.name)) continue;
            const asset = imageAssets.find((a) => String(a._id) === String(record.imageAssetId));
            if (!asset) continue;
            try {
                const content = await readStoredAsset(asset);
                const cid = `${record.name}@send-email`;
                images.push({ filename: asset.originalName || `${record.name}.png`, content, mimeType: asset.mimeType, size: content.length, cid });
                cidByName[record.name] = cid;
            } catch (readErr) {
                logger.logWarning('Send Email - image could not be read, sending without it', { vendorId, imageAssetId: asset._id, err: readErr });
            }
        }
        const placeImages = (html) => String(html || '').replace(IMAGE_TOKEN, (match, name) => {
            const cid = cidByName[name.toLowerCase()];
            return cid ? `<img src="cid:${cid}" alt="${name}" style="max-width:100%;height:auto;" />` : '';
        });
        const stripImages = (str) => String(str || '').replace(IMAGE_TOKEN, '');

        const limits = {
            maxAttachments: companyMasterData?.numberOfAttachmentsAllowedInSendEmail ?? null,
            maxAttachmentSizeMB: companyMasterData?.attachmentSizeAllowedInSendEmail ?? null,
            maxImages: companyMasterData?.numberOfImagesAllowedInSendEmail ?? null,
            maxImageSizeMB: companyMasterData?.imageSizeAllowedInSendEmail ?? null
        };

        // A resumed send (see resumeInterruptedSends) carries on after the
        // recipients already done.
        let sentCount = sentEmail.recipients.filter((r) => r.status === 'SENT').length;
        let failedCount = sentEmail.recipients.filter((r) => r.status === 'FAILED').length;
        let stoppedReason = null;
        for (let i = 0; i < sentEmail.recipients.length; i++) {
            const recipient = sentEmail.recipients[i];
            if (stoppedReason) break;
            if (recipient.status !== 'PENDING') continue;

            // Marked first, so a restart mid-send can tell this one apart.
            await SentEmail.updateOne({ _id: sentEmailId }, { $set: { [`recipients.${i}.status`]: 'SENDING' } });

            const tokens = { customerName: recipient.name || '', customerEmail: recipient.email, companyName: companySettingsData?.companyName || '' };
            const result = await emailService.sendEmail({
                vendorId,
                module: SEND_EMAIL_MODULE,
                to: recipient.email,
                cc: sentEmail.ccList,
                bcc: sentEmail.bccList,
                includeCompanyCc: sentEmail.includeCompanyCcList,
                includeCompanyBcc: sentEmail.includeCompanyBccList,
                subject: stripImages(emailService.renderTemplateString(sentEmail.subject, tokens)),
                html: placeImages(emailService.renderTemplateString(sentEmail.htmlBody, tokens)),
                text: sentEmail.textBody ? stripImages(emailService.renderTemplateString(sentEmail.textBody, tokens)) : undefined,
                attachments,
                images,
                userId: sentEmail.createdBy,
                companyMasterData,
                websiteMasterData,
                companySettingsData,
                limits
            }).catch((err) => ({ isSuccess: false, statusCode: 500, message: err.message || 'Could not send' }));

            const update = result && result.isSuccess
                ? { status: 'SENT', emailLogId: result.meta?.emailLogId || null, sentAt: new Date(), error: null }
                : { status: 'FAILED', error: result?.message || 'Could not send' };
            if (update.status === 'SENT') sentCount += 1; else failedCount += 1;
            await SentEmail.updateOne(
                { _id: sentEmailId },
                { $set: Object.fromEntries(Object.entries(update).map(([k, v]) => [`recipients.${i}.${k}`, v])) }
            );

            // Quota used up / email switched off: the rest can't go either.
            if (result && result.statusCode === 403) stoppedReason = result.message;
        }

        const skippedCount = Math.max(sentEmail.recipients.length - sentCount - failedCount, 0);
        const finalUpdate = {
            sendStatus: stoppedReason ? 'STOPPED' : 'COMPLETED',
            stoppedReason,
            sentCount,
            failedCount,
            skippedCount,
            completedAt: new Date()
        };
        if (skippedCount > 0) {
            await SentEmail.updateOne({ _id: sentEmailId }, { $set: { 'recipients.$[r].status': 'SKIPPED' } }, { arrayFilters: [{ 'r.status': 'PENDING' }] });
        }
        await SentEmail.updateOne({ _id: sentEmailId }, { $set: finalUpdate });
        logger.logInfo(sentCount, failedCount + skippedCount, 'Send Email delivered', { vendorId, sentEmailId, ...finalUpdate });
    } catch (err) {
        throw err;
    }
};

// A send counts as interrupted when it's still SENDING but hasn't been
// touched for this long (every recipient updates it, so a live send is
// never this quiet).
const INTERRUPTED_AFTER_MS = 5 * 60 * 1000;
const INTERRUPTED_MESSAGE = 'Sending was interrupted by a server restart - this email may or may not have been delivered, so it was not sent again.';

/**
 * Called at server start (sentEmailCleanupService.startSendEmailCleanup
 * schedules it): picks up sends a restart cut short. Recipients still
 * PENDING are sent; one caught mid-send (SENDING) is marked FAILED rather
 * than risking a second copy. Masters/settings are read fresh from the DB.
 */
const resumeInterruptedSends = async () => {
    try {
        const CompanyMaster = require('../models/CompanyMaster');
        const WebsiteMaster = require('../models/WebsiteMaster');
        const CompanySettings = require('../models/CompanySettings');

        const cutoff = new Date(Date.now() - INTERRUPTED_AFTER_MS);
        const interrupted = await SentEmail.find({ sendStatus: 'SENDING', updatedAt: { $lt: cutoff } }).select('_id vendorId').lean();
        if (interrupted.length === 0) return 0;

        const websiteMasterData = await WebsiteMaster.findOne({}).lean();
        for (const item of interrupted) {
            // Claim it (another server may be doing the same) - bumping updatedAt.
            const claimed = await SentEmail.updateOne(
                { _id: item._id, sendStatus: 'SENDING', updatedAt: { $lt: cutoff } },
                {
                    $inc: { resumeCount: 1 },
                    $set: { 'recipients.$[inFlight].status': 'FAILED', 'recipients.$[inFlight].error': INTERRUPTED_MESSAGE }
                },
                { arrayFilters: [{ 'inFlight.status': 'SENDING' }] }
            );
            if (!claimed.modifiedCount) continue;

            const [companyMasterData, companySettingsData] = await Promise.all([
                CompanyMaster.findOne({ vendorId: item.vendorId }).lean(),
                CompanySettings.findOne({ vendorId: item.vendorId }).lean()
            ]);
            logger.logInfo(1, 0, 'Send Email - resuming a send interrupted by a restart', { vendorId: item.vendorId, sentEmailId: item._id });
            await deliver(item._id, companyMasterData, websiteMasterData, companySettingsData).catch((err) => {
                logger.logWarning('Send Email - resumed delivery failed', { sentEmailId: item._id, err });
            });
        }
        return interrupted.length;
    } catch (err) {
        throw err;
    }
};

// History list - newest first, without bodies/recipient lists.
const fetchHistory = async (vendorId, { page = 1, limit = 20 } = {}, companyMasterData, websiteMasterData) => {
    try {
        const gate = checkSendEmailOn(companyMasterData, websiteMasterData);
        if (!gate.isSuccess) return gate;
        const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const safePage = Math.max(Number(page) || 1, 1);
        const match = { vendorId: new mongoose.Types.ObjectId(String(vendorId)), status: { $ne: 'D' } };
        const [items, total] = await Promise.all([
            SentEmail.aggregate([
                { $match: match },
                { $sort: { createdAt: -1 } },
                { $skip: (safePage - 1) * safeLimit },
                { $limit: safeLimit },
                {
                    $project: {
                        subject: 1, recipientSelection: 1, sendStatus: 1, stoppedReason: 1, sentCount: 1, failedCount: 1,
                        skippedCount: 1, sentByName: 1, createdAt: 1, completedAt: 1,
                        recipientCount: { $size: '$recipients' },
                        attachmentCount: { $size: '$attachments' },
                        imageCount: { $size: '$images' }
                    }
                }
            ]),
            SentEmail.countDocuments(match)
        ]);
        return common.returnResult(true, 200, 'Sent emails fetched successfully', { items, total, page: safePage, limit: safeLimit });
    } catch (err) {
        throw err;
    }
};

const fetchHistoryById = async (vendorId, sentEmailId, companyMasterData, websiteMasterData) => {
    try {
        const gate = checkSendEmailOn(companyMasterData, websiteMasterData);
        if (!gate.isSuccess) return gate;
        const sentEmail = await SentEmail.findOne({ _id: sentEmailId, vendorId, status: { $ne: 'D' } }).lean();
        if (!sentEmail) {
            return common.returnResult(false, 404, 'Sent email not found.');
        }
        return common.returnResult(true, 200, 'Sent email fetched successfully', { sentEmail });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    SEND_EMAIL_VARIABLES,
    UPLOAD_ATTACHMENT_MODULE,
    UPLOAD_IMAGE_MODULE,
    getSendEmailAccess,
    fetchSendEmailOptions,
    searchCustomers,
    sendComposedEmail,
    resumeInterruptedSends,
    fetchHistory,
    fetchHistoryById
};
