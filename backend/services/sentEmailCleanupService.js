const SentEmail = require('../models/SentEmail');
const WebsiteMaster = require('../models/WebsiteMaster');
const fileUploadService = require('./fileUploadService');
const imageUploadService = require('./imageUploadService');
const redisService = require('./redisService');
const sentEmailService = require('./sentEmailService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');

/*
|--------------------------------------------------------------------------
| SEND EMAIL FILE CLEAN-UP
|--------------------------------------------------------------------------
| Files uploaded for one Send Email email (source UPLOAD) are deleted from
| storage WebsiteMaster.sendEmailFileRetentionDays after it was sent (0 =
| keep forever). The history entry stays; its files are marked unavailable.
| Company Settings library files are never touched. Runs hourly from
| server.js, guarded by a Redis lock like the other scanners.
*/

const SCAN_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_SCAN_DELAY_MS = 2 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;

const cleanUpExpiredSendEmailFiles = async () => {
    try {
        const websiteMasterData = await WebsiteMaster.findOne({}).select('sendEmailFileRetentionDays').lean();
        const retentionDays = websiteMasterData?.sendEmailFileRetentionDays ?? 90;
        if (!retentionDays || retentionDays <= 0) return 0;

        const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
        const due = await SentEmail.find({
            filesDeletedAt: null,
            createdAt: { $lt: cutoff },
            $or: [{ 'attachments.source': 'UPLOAD' }, { 'images.source': 'UPLOAD' }]
        }).limit(BATCH_SIZE).lean();

        for (const sentEmail of due) {
            const attachments = sentEmail.attachments || [];
            const images = sentEmail.images || [];
            for (const file of attachments.filter((a) => a.source === 'UPLOAD' && a.fileAssetId)) {
                await fileUploadService.deleteFile({ vendorId: sentEmail.vendorId, fileId: file.fileAssetId, userId: null }).catch((err) => {
                    logger.logWarning('Send Email clean-up - could not delete a file', { sentEmailId: sentEmail._id, err });
                });
            }
            for (const image of images.filter((img) => img.source === 'UPLOAD' && img.imageAssetId)) {
                await imageUploadService.deleteImage({ imageId: image.imageAssetId, userId: null }).catch((err) => {
                    logger.logWarning('Send Email clean-up - could not delete an image', { sentEmailId: sentEmail._id, err });
                });
            }
            // Only touch arrays that hold uploads (an array filter on a missing
            // array would fail the whole update).
            const markUnavailable = { filesDeletedAt: new Date() };
            if (attachments.some((a) => a.source === 'UPLOAD')) markUnavailable['attachments.$[upload].available'] = false;
            if (images.some((img) => img.source === 'UPLOAD')) markUnavailable['images.$[upload].available'] = false;
            const usesFilter = Object.keys(markUnavailable).length > 1;
            await SentEmail.updateOne(
                { _id: sentEmail._id },
                { $set: markUnavailable },
                usesFilter ? { arrayFilters: [{ 'upload.source': 'UPLOAD' }] } : {}
            );
        }

        if (due.length) logger.logInfo(1, 0, 'Send Email files cleaned up', { emails: due.length, retentionDays });
        return due.length;
    } catch (err) {
        throw err;
    }
};

let scanIntervalHandle = null;

const runLockedCleanUp = async () => {
    try {
        const acquired = await redisService.acquireLock(redisKeys.sendEmailCleanupLock(), Math.floor(SCAN_INTERVAL_MS / 1000));
        if (!acquired) return;
        await cleanUpExpiredSendEmailFiles();
    } catch (err) {
        logger.logWarning('Exception in sentEmailCleanupService.runLockedCleanUp', { error: err });
    }
};

// Sends a restart cut short - picked up once, shortly after boot (a
// Redis lock keeps two servers from both resuming).
const RESUME_DELAY_MS = 30 * 1000;
const runLockedResume = async () => {
    try {
        const acquired = await redisService.acquireLock(redisKeys.sendEmailResumeLock(), 10 * 60);
        if (!acquired) return;
        const resumed = await sentEmailService.resumeInterruptedSends();
        if (resumed) logger.logInfo(1, 0, 'Send Email - interrupted sends picked up', { count: resumed });
    } catch (err) {
        logger.logWarning('Exception in sentEmailCleanupService.runLockedResume', { error: err });
    }
};

const startSendEmailCleanup = () => {
    try {
        if (scanIntervalHandle) return;
        setTimeout(runLockedResume, RESUME_DELAY_MS);
        setTimeout(runLockedCleanUp, FIRST_SCAN_DELAY_MS);
        scanIntervalHandle = setInterval(runLockedCleanUp, SCAN_INTERVAL_MS);
        logger.logInfo(1, 0, 'Send Email file clean-up started', { intervalMs: SCAN_INTERVAL_MS });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    runLockedResume,
    cleanUpExpiredSendEmailFiles,
    startSendEmailCleanup
};
