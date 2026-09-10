const CommissionLedgerEntry = require('../models/CommissionLedgerEntry');
const { COMMISSION_LEDGER_STATUSES } = require('../constants/commissionConstants');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Called right after an order is placed (orderService.createOrderFromCart) -
// a no-op (returns null, not an error) whenever the vendor doesn't have
// commission turned on or has no rate set, so most vendors never get a
// ledger entry at all. Runs regardless of payment method (ONLINE or COD) -
// commission is owed for the sale itself, not tied to when/whether the
// gateway confirms payment, since COD orders never flow through the gateway
// at all.
const recordCommissionForOrder = async (order, companyMasterData) => {
    try {
        if (!companyMasterData?.isCommissionFeatureOn || !companyMasterData?.commissionPercentage) {
            return null;
        }

        const commissionBaseAmount = Math.max(0, (order.subtotal || 0) - (order.totalDiscountAmount || 0));
        const commissionAmount = Math.round(commissionBaseAmount * companyMasterData.commissionPercentage) / 100;

        const entry = new CommissionLedgerEntry({
            orderId: order._id,
            orderNumber: order.orderNumber,
            vendorId: order.vendorId,
            commissionBaseAmount,
            commissionPercentage: companyMasterData.commissionPercentage,
            commissionAmount,
            currencyCode: order.currencyCode,
            ledgerStatus: COMMISSION_LEDGER_STATUSES.PENDING,
            createdBy: order.createdBy
        });
        await entry.save();

        logger.logInfo(1, 0, 'Commission ledger entry recorded', { vendorId: order.vendorId, orderId: order._id, commissionAmount });
        return entry;
    } catch (err) {
        throw err;
    }
};

// Called when an order is cancelled/rejected (orderService.cancelOrder /
// advanceOrderStep -> REJECTED) - a no-op if no ledger entry exists
// (commission wasn't on for this vendor) or it's already voided. An entry
// already marked COLLECTED is deliberately left alone (the money's already
// been taken from the vendor) - just logged, since that needs a human
// decision (refund it back?), not an automatic void.
const voidCommissionForOrder = async (vendorId, orderId, reason) => {
    try {
        const entry = await CommissionLedgerEntry.findOne({ vendorId, orderId });
        if (!entry || entry.ledgerStatus === COMMISSION_LEDGER_STATUSES.VOIDED) {
            return null;
        }

        if (entry.ledgerStatus === COMMISSION_LEDGER_STATUSES.COLLECTED) {
            logger.logInfo(0, 1, 'Order cancelled after its commission was already collected - needs manual reconciliation', { vendorId, orderId });
            return entry;
        }

        entry.ledgerStatus = COMMISSION_LEDGER_STATUSES.VOIDED;
        entry.voidedAt = new Date();
        entry.voidReason = reason || 'Order cancelled.';
        await entry.save();

        logger.logInfo(1, 0, 'Commission ledger entry voided', { vendorId, orderId });
        return entry;
    } catch (err) {
        throw err;
    }
};

// Admin-only bookkeeping actions - see scripts/manageCommissionLedger.js.
const markCollected = async (vendorId, adminUserId, entryId, notes) => {
    try {
        const entry = await CommissionLedgerEntry.findOne({ _id: entryId, vendorId });
        if (!entry) {
            return common.returnResult(false, 404, 'Commission ledger entry not found.');
        }
        if (entry.ledgerStatus !== COMMISSION_LEDGER_STATUSES.PENDING) {
            return common.returnResult(false, 400, `This entry is already ${entry.ledgerStatus}.`);
        }

        entry.ledgerStatus = COMMISSION_LEDGER_STATUSES.COLLECTED;
        entry.collectedAt = new Date();
        entry.collectedNotes = notes || null;
        entry.updatedBy = adminUserId;
        await entry.save();

        return common.returnResult(true, 200, 'Marked as collected.', { entry });
    } catch (err) {
        throw err;
    }
};

const listByVendor = async (vendorId, ledgerStatus) => {
    try {
        const filter = { vendorId };
        if (ledgerStatus) {
            filter.ledgerStatus = ledgerStatus;
        }
        const entries = await CommissionLedgerEntry.find(filter).sort({ createdAt: -1 });
        return entries;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    recordCommissionForOrder,
    voidCommissionForOrder,
    markCollected,
    listByVendor
};
