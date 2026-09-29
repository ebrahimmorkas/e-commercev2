const CompanyMaster = require('../models/CompanyMaster');
const WebsiteMaster = require('../models/WebsiteMaster');
const CompanySettings = require('../models/CompanySettings');
const Discount = require('../models/Discount');
const FreeCash = require('../models/FreeCash');
const UserFreeCash = require('../models/UserFreeCash');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const promotionEmailService = require('./promotionEmailService');
const { EMAIL_MODULES, PROMOTION_EMAIL_FLAGS } = require('../constants/emailModuleConstants');
const logger = require('../utils/logger');

/*
|--------------------------------------------------------------------------
| "EXPIRING SOON" REMINDERS (Discount / Free Cash)
|--------------------------------------------------------------------------
| Started at boot from server.js. Every hour it looks, per vendor, for
| active discounts and Free Cash whose end date falls within the vendor's
| reminder window (CompanySettings.discountExpiryReminderDays /
| freeCashExpiryReminderDays, default 3 days) and emails them once:
|   - a discount: its customers (see promotionEmailService recipients);
|   - Free Cash: every customer still holding an unused, unexpired grant of
|     it; a campaign that isn't user-targeted also emails every customer
|     when freeCashEmailRecipients is 'ALL'.
| Each reminder is claimed (expiryReminderSentAt set) BEFORE it's sent, with
| a conditional update, so two servers running the scan can never both send
| it. Changing an end date clears the claim (see discount/freeCash services).
| Guarded by a Redis lock like the abandoned-cart scanner.
*/

const SCAN_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_SCAN_DELAY_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMINDER_DAYS = 3;

const isFlagOn = (flag, websiteMasterData, companyMasterData) => {
    try {
        return websiteMasterData?.[flag] === true && companyMasterData?.[flag] === true;
    } catch (err) {
        throw err;
    }
};

const windowEnd = (now, days) => {
    try {
        return new Date(now.getTime() + (days || DEFAULT_REMINDER_DAYS) * DAY_MS);
    } catch (err) {
        throw err;
    }
};

const remindDiscounts = async (vendorId, now, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        if (!isFlagOn(PROMOTION_EMAIL_FLAGS[EMAIL_MODULES.DISCOUNT_EXPIRING_SOON], websiteMasterData, companyMasterData)) return 0;
        if (companyMasterData?.isDiscountFeatureOn !== true || websiteMasterData?.isDiscountFeatureOn !== true) return 0;

        const due = await Discount.find({
            vendorId,
            status: 'A',
            isDiscountForceClosed: { $ne: true },
            endDate: { $gt: now, $lte: windowEnd(now, companySettingsData?.discountExpiryReminderDays) },
            expiryReminderSentAt: null
        }).lean();

        let reminded = 0;
        for (const discount of due) {
            const claimed = await Discount.updateOne(
                { _id: discount._id, expiryReminderSentAt: null },
                { $set: { expiryReminderSentAt: now } }
            );
            if (!claimed.modifiedCount) continue;
            await promotionEmailService.sendDiscountExpiringSoon({ vendorId, discount, companyMasterData, websiteMasterData, companySettingsData });
            reminded += 1;
        }
        return reminded;
    } catch (err) {
        throw err;
    }
};

const remindFreeCash = async (vendorId, now, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        if (!isFlagOn(PROMOTION_EMAIL_FLAGS[EMAIL_MODULES.FREE_CASH_EXPIRING_SOON], websiteMasterData, companyMasterData)) return 0;
        if (companyMasterData?.isFreeCashFeatureOn !== true || websiteMasterData?.isFreeCashFeatureOn !== true) return 0;

        const campaigns = await FreeCash.find({
            vendorId,
            status: 'A',
            endDate: { $gt: now, $lte: windowEnd(now, companySettingsData?.freeCashExpiryReminderDays) }
        }).lean();

        let reminded = 0;
        for (const freeCash of campaigns) {
            const isTargeted = promotionEmailService.isUserTargetedFreeCash(freeCash);

            // Not user-targeted and "All customers" chosen: one reminder to everyone.
            if (!isTargeted && companySettingsData?.freeCashEmailRecipients === 'ALL') {
                const claimed = await FreeCash.updateOne(
                    { _id: freeCash._id, expiryReminderSentAt: null },
                    { $set: { expiryReminderSentAt: now } }
                );
                if (claimed.modifiedCount) {
                    await promotionEmailService.sendFreeCashExpiringSoonToAll({ vendorId, freeCash, companyMasterData, websiteMasterData, companySettingsData });
                    reminded += 1;
                }
                continue;
            }

            // Otherwise: each customer still holding some of it.
            const grantFilter = {
                vendorId,
                freeCashId: freeCash._id,
                status: 'A',
                isCashExpired: false,
                isRevoked: false,
                remainingAmount: { $gt: 0 },
                expiryReminderSentAt: null
            };
            const grants = await UserFreeCash.find(grantFilter).lean();
            if (grants.length === 0) continue;
            await UserFreeCash.updateMany(
                { _id: { $in: grants.map((g) => g._id) }, expiryReminderSentAt: null },
                { $set: { expiryReminderSentAt: now } }
            );
            await promotionEmailService.sendFreeCashExpiringSoonForGrants({ vendorId, grants, companyMasterData, websiteMasterData, companySettingsData });
            reminded += grants.length;
        }
        return reminded;
    } catch (err) {
        throw err;
    }
};

// One pass over every vendor. Errors for one vendor are logged and don't
// stop the others.
const scanAndSendExpiryReminders = async () => {
    try {
        const now = new Date();
        const websiteMasterData = await WebsiteMaster.findOne({}).lean();
        if (!websiteMasterData) return;

        const companies = await CompanyMaster.find({}).lean();
        for (const companyMasterData of companies) {
            const vendorId = companyMasterData.vendorId;
            try {
                const companySettingsData = await CompanySettings.findOne({ vendorId }).lean();
                const discounts = await remindDiscounts(vendorId, now, companyMasterData, websiteMasterData, companySettingsData);
                const freeCash = await remindFreeCash(vendorId, now, companyMasterData, websiteMasterData, companySettingsData);
                if (discounts || freeCash) {
                    logger.logInfo(1, 0, 'Expiry reminders sent', { vendorId, discounts, freeCashGrants: freeCash });
                }
            } catch (vendorErr) {
                logger.logWarning('Expiry reminder scan failed for a vendor', { vendorId, err: vendorErr });
            }
        }
    } catch (err) {
        logger.logWarning('Exception in expiryReminderService.scanAndSendExpiryReminders', { error: err });
    }
};

let scanIntervalHandle = null;

const runLockedScan = async () => {
    try {
        const acquired = await redisService.acquireLock(redisKeys.expiryReminderScanLock(), Math.floor(SCAN_INTERVAL_MS / 1000));
        if (!acquired) return;
        await scanAndSendExpiryReminders();
    } catch (err) {
        logger.logWarning('Exception in expiryReminderService.runLockedScan', { error: err });
    }
};

const startExpiryReminderScanner = () => {
    try {
        if (scanIntervalHandle) return;
        // First pass shortly after boot, then every hour.
        setTimeout(runLockedScan, FIRST_SCAN_DELAY_MS);
        scanIntervalHandle = setInterval(runLockedScan, SCAN_INTERVAL_MS);
        logger.logInfo(1, 0, 'Expiry reminder scanner started', { intervalMs: SCAN_INTERVAL_MS });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    scanAndSendExpiryReminders,
    startExpiryReminderScanner
};
