const Product = require('../models/Product');
const emailService = require('./emailService');
const lowStockAlertEmail = require('../emailTemplates/lowStockAlertEmail');
const common = require('../utils/common');
const logger = require('../utils/logger');
const {
    STOCK_FILTERS,
    LOW_STOCK_ALERT_FEATURE_FLAG,
    FALLBACK_LOW_STOCK_THRESHOLD,
    LOW_STOCK_ALERT_EMAIL_MODULE
} = require('../constants/inventoryConstants');

/*
|--------------------------------------------------------------------------
| LOW STOCK
|--------------------------------------------------------------------------
| One threshold per vendor, for every product size:
|   - Alert ON  = isReceivingLowStockAlertFeatureOn in WebsiteMaster AND
|     CompanyMaster, and the vendor switched "Receive low stock alert" on in
|     Company Settings > Product with a threshold. That threshold drives both
|     the email and the Inventory module's low stock indicator.
|   - Otherwise no email is sent, and the Inventory indicator uses
|     DEFAULT_LOW_STOCK_THRESHOLD from .env.
|
| "Low" includes the threshold itself (threshold 5 -> low at 5 and below).
| A size at 0 is "out of stock", shown separately.
|
| The email goes out only when a size CROSSES the threshold (was above it,
| now at or below it) - so once per drop, and again only after the size was
| restocked above the threshold and dropped once more. Every size that
| crossed in the same order / adjustment is listed in ONE email, sent from
| the vendor's own email account to their admin email. It goes through
| emailService.sendEmail like every other email, so it counts in the
| vendor's email quota.
*/

const getDefaultLowStockThreshold = () => {
    try {
        const parsed = Number(process.env.DEFAULT_LOW_STOCK_THRESHOLD);
        const isUsable = process.env.DEFAULT_LOW_STOCK_THRESHOLD !== undefined
            && String(process.env.DEFAULT_LOW_STOCK_THRESHOLD).trim() !== ''
            && Number.isInteger(parsed)
            && parsed >= 0;
        return isUsable ? parsed : FALLBACK_LOW_STOCK_THRESHOLD;
    } catch (err) {
        throw err;
    }
};

// { isFeatureOn, isAlertOn, threshold, isVendorThreshold }
const resolveLowStockSettings = (websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const isFeatureOn = websiteMasterData?.[LOW_STOCK_ALERT_FEATURE_FLAG] === true
            && companyMasterData?.[LOW_STOCK_ALERT_FEATURE_FLAG] === true;

        const vendorThreshold = companySettingsData?.lowStockAlertThreshold;
        const hasVendorThreshold = Number.isInteger(vendorThreshold) && vendorThreshold >= 0;
        const isAlertOn = isFeatureOn && companySettingsData?.receiveLowStockAlert === true && hasVendorThreshold;

        return {
            isFeatureOn,
            isAlertOn,
            threshold: isAlertOn ? vendorThreshold : getDefaultLowStockThreshold(),
            isVendorThreshold: isAlertOn
        };
    } catch (err) {
        throw err;
    }
};

const getStockLevel = (stock, threshold) => {
    try {
        const quantity = Number(stock) || 0;
        if (quantity <= 0) return STOCK_FILTERS.OUT_OF_STOCK;
        if (quantity <= threshold) return STOCK_FILTERS.LOW_STOCK;
        return STOCK_FILTERS.IN_STOCK;
    } catch (err) {
        throw err;
    }
};

const escapeHtml = (value) => {
    try {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    } catch (err) {
        throw err;
    }
};

// Adds what a stock deduction did to one size onto "stockChanges" (the list
// later handed to sendLowStockAlertInBackground). "productBefore" is the
// product as it was BEFORE the $inc - exactly what findOneAndUpdate returns
// without "new: true" - so the "before" figure is the real one even when two
// orders hit the same size at the same moment. Increases are ignored: stock
// going up can never make a size low.
const trackStockDeduction = (stockChanges, productBefore, variantId, sizeId, delta) => {
    try {
        if (!Array.isArray(stockChanges) || !productBefore || !(delta < 0)) return;
        const variant = (productBefore.variants || []).find((v) => v._id.toString() === variantId.toString());
        const size = (variant?.sizes || []).find((s) => s._id.toString() === sizeId.toString());
        if (!size) return;
        const previousStock = Number(size.stock) || 0;
        stockChanges.push({
            productId: productBefore._id,
            variantId: variant._id,
            sizeId: size._id,
            previousStock,
            newStock: previousStock + delta
        });
    } catch (err) {
        throw err;
    }
};

// stockChanges: [{ productId, variantId, sizeId, previousStock, newStock }].
// A size may appear more than once (two lines of one order) - its first
// "previous" and its last "new" are what matter. Returns the sizes that went
// from above the threshold to at/below it.
const findSizesThatCrossedThreshold = (stockChanges, threshold) => {
    try {
        const bySize = new Map();
        for (const change of (stockChanges || [])) {
            if (!change || !change.sizeId) continue;
            const key = change.sizeId.toString();
            const existing = bySize.get(key);
            if (!existing) {
                bySize.set(key, { ...change });
            } else {
                existing.previousStock = Math.max(existing.previousStock, change.previousStock);
                existing.newStock = Math.min(existing.newStock, change.newStock);
            }
        }
        return [...bySize.values()].filter((change) => change.previousStock > threshold && change.newStock <= threshold);
    } catch (err) {
        throw err;
    }
};

// Reads the sizes fresh, so the email shows what is left right now, and a
// size whose stock was given back in the meantime (a rolled-back order) is
// left out.
const loadLowStockRows = async (vendorId, crossedSizes, threshold) => {
    try {
        const productIds = [...new Set(crossedSizes.map((change) => change.productId.toString()))];
        const products = await Product.find({ _id: { $in: productIds }, vendorId, status: { $in: ['A', 'I'] } })
            .select('name variants._id variants.color variants.displayName variants.status variants.sizes._id variants.sizes.sizeName variants.sizes.sku variants.sizes.stock variants.sizes.status')
            .lean();
        const productById = new Map(products.map((product) => [product._id.toString(), product]));

        const rows = [];
        for (const change of crossedSizes) {
            const product = productById.get(change.productId.toString());
            const variant = product?.variants?.find((v) => v._id.toString() === change.variantId.toString());
            const size = variant?.sizes?.find((s) => s._id.toString() === change.sizeId.toString());
            if (!size || variant.status === 'D' || size.status === 'D') continue;

            const currentStock = Math.max(0, Number(size.stock) || 0);
            if (currentStock > threshold) continue;

            rows.push({
                productName: product.name,
                variantName: variant.displayName || variant.color || 'Default',
                sizeName: size.sizeName || '',
                sku: size.sku || '',
                currentStock,
                stockStatus: currentStock <= 0 ? 'Out of stock' : 'Low stock'
            });
        }
        return rows;
    } catch (err) {
        throw err;
    }
};

const buildLowStockEmail = (rows, threshold, companySettingsData) => {
    try {
        const sharedTokens = {
            companyName: companySettingsData?.companyName || 'your store',
            adminName: companySettingsData?.adminName || 'Admin',
            threshold,
            itemCount: rows.length
        };
        const escapedSharedTokens = Object.fromEntries(
            Object.entries(sharedTokens).map(([key, value]) => [key, escapeHtml(value)])
        );

        const htmlRows = rows.map((row) => emailService.renderTemplateString(
            lowStockAlertEmail.ROW_HTML,
            Object.fromEntries(Object.entries(row).map(([key, value]) => [key, escapeHtml(value)]))
        )).join('');
        const textRows = rows.map((row) => emailService.renderTemplateString(lowStockAlertEmail.ROW_TEXT, row)).join('\n');

        return {
            subject: emailService.renderTemplateString(lowStockAlertEmail.SUBJECT, sharedTokens),
            html: emailService.renderTemplateString(lowStockAlertEmail.HTML, { ...escapedSharedTokens, rows: htmlRows }),
            text: emailService.renderTemplateString(lowStockAlertEmail.TEXT, { ...sharedTokens, rows: textRows })
        };
    } catch (err) {
        throw err;
    }
};

// Sends ONE email listing every size in stockChanges that crossed the
// vendor's threshold. A "nothing to send" outcome is a success with
// meta.sent = false.
const sendLowStockAlert = async ({ vendorId, stockChanges, websiteMasterData, companyMasterData, companySettingsData, userId = null }) => {
    try {
        const settings = resolveLowStockSettings(websiteMasterData, companyMasterData, companySettingsData);
        if (!settings.isAlertOn) {
            return common.returnResult(true, 200, 'Low stock alert is off', { sent: false });
        }

        const crossedSizes = findSizesThatCrossedThreshold(stockChanges, settings.threshold);
        if (crossedSizes.length === 0) {
            return common.returnResult(true, 200, 'No size reached the low stock quantity', { sent: false });
        }

        const adminEmail = companySettingsData?.adminEmail;
        if (!adminEmail) {
            return common.returnResult(false, 400, 'Admin email is not set in Company Settings.', { sent: false });
        }

        const rows = await loadLowStockRows(vendorId, crossedSizes, settings.threshold);
        if (rows.length === 0) {
            return common.returnResult(true, 200, 'No size is low on stock any more', { sent: false });
        }

        const { subject, html, text } = buildLowStockEmail(rows, settings.threshold, companySettingsData);

        // isDefaultTemplate: platform-written content, so the vendor's
        // link / formatting restrictions don't apply to it. Company CC/BCC
        // lists are for customer emails - this one is the vendor's own.
        const sendResult = await emailService.sendEmail({
            vendorId,
            module: LOW_STOCK_ALERT_EMAIL_MODULE,
            to: adminEmail,
            subject,
            html,
            text,
            userId,
            companyMasterData,
            websiteMasterData,
            companySettingsData,
            isDefaultTemplate: true,
            includeCompanyCc: false,
            includeCompanyBcc: false
        });
        if (!sendResult.isSuccess) {
            return common.returnResult(false, sendResult.statusCode, sendResult.message, { sent: false });
        }

        logger.logInfo(1, 0, 'Low stock alert email sent', { vendorId, sizes: rows.length });
        return common.returnResult(true, 200, 'Low stock alert email sent', { sent: true, sizes: rows.length });
    } catch (err) {
        throw err;
    }
};

// Runs after the current request has been answered: the stock change itself
// is already saved, so a failed or refused email (quota reached, email
// account not set up, ...) is only ever logged - it never fails an order or
// a stock adjustment. A promise-level .catch (not a try/catch block), same as
// promotionEmailService.runInBackground.
const sendLowStockAlertInBackground = (args) => {
    try {
        if (!args || !Array.isArray(args.stockChanges) || args.stockChanges.length === 0) return;
        setImmediate(() => {
            sendLowStockAlert(args)
                .then((result) => {
                    if (!result.isSuccess) {
                        logger.logWarning('Low stock alert email was not sent', { vendorId: args.vendorId, reason: result.message });
                    }
                })
                .catch((err) => logger.logWarning('Low stock alert - background email send failed', { vendorId: args.vendorId, err }));
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getDefaultLowStockThreshold,
    resolveLowStockSettings,
    getStockLevel,
    trackStockDeduction,
    findSizesThatCrossedThreshold,
    sendLowStockAlert,
    sendLowStockAlertInBackground
};
