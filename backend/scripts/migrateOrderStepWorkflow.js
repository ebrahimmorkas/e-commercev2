// One-time migration for the configurable order-step workflow (order-bug
// branch). Safe to run more than once. Run once per environment, after
// deploying the code and BEFORE using the app:
//   node scripts/migrateOrderStepWorkflow.js
//
// 1. Templates: Rejected (and any other built-in side step) is no longer a
//    template step - it's removed from every OrderStepMaster. Sequences are
//    left as they are (gaps are fine: "next" is the next higher sequence).
// 2. Orders: a customer's own cancellation used to share the REJECTED step;
//    it becomes CANCELLED. Every order gets isFinalized (true when it sits on
//    the LAST step of its workflow) and isPaymentAtDelivery (false).
// 3. Invoice: the one-invoice-per-order unique index becomes one LIVE
//    (ISSUED) invoice per order, so a restarted order can get a new invoice.
// 4. Company Settings: an order step setting that isn't a step of the
//    vendor's assigned workflow (e.g. the old "REJECTED" cancellation
//    cutoff) is cleared.
// 5. WebsiteMaster: delivery agents now need a platform-wide switch as well
//    (isOrderStatusUpdationAllowedByDeliveryAgents). Where it isn't set yet
//    it's turned on, so vendors who already have agents keep them - turn it
//    off afterwards if you want the feature off for everyone.
//
// Then run `node seeds/seedModuleMaster.js` and `node seeds/backfillAssignedModules.js`
// so vendors with agents switched on get the new Delivery Agents page.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const OrderStepMaster = require('../models/OrderStepMaster');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const WebsiteMaster = require('../models/WebsiteMaster');
const CompanyMaster = require('../models/CompanyMaster');
const CompanySettings = require('../models/CompanySettings');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const { connectRedis } = require('../config/redisConfig');
const { RESERVED_STEP_CODES, SIDE_STEP_NAMES, TEMPLATE_FORBIDDEN_CODES } = require('../constants/orderStepConstants');

const STEP_SETTING_FIELDS = ['orderCancellationNotAllowedAfterStep', 'markPaymentCompletedAtStep', 'deliveryAgentFromStep', 'deliveryAgentToStep'];

const migrateTemplates = async () => {
    try {
        // Straight on the collection: the model's validator would reject the old steps before they're removed.
        const result = await OrderStepMaster.collection.updateMany(
            { 'steps.code': { $in: TEMPLATE_FORBIDDEN_CODES } },
            { $pull: { steps: { code: { $in: TEMPLATE_FORBIDDEN_CODES } } } }
        );
        console.log(`Templates: removed side steps from ${result.modifiedCount} template(s).`);
    } catch (err) {
        throw err;
    }
};

const migrateOrders = async () => {
    try {
        // Customer cancellations: REJECTED + cancelledBy === the customer.
        const cancelledByCustomer = await Order.collection.find(
            { currentStepCode: RESERVED_STEP_CODES.REJECTED, userId: { $ne: null }, $expr: { $eq: ['$cancelledBy', '$userId'] } },
            { projection: { _id: 1, statusHistory: 1 } }
        ).toArray();
        for (const order of cancelledByCustomer) {
            const history = order.statusHistory || [];
            const lastIndex = history.length - 1;
            const set = {
                currentStepCode: RESERVED_STEP_CODES.CANCELLED,
                currentStepName: SIDE_STEP_NAMES[RESERVED_STEP_CODES.CANCELLED]
            };
            if (lastIndex >= 0 && history[lastIndex].stepCode === RESERVED_STEP_CODES.REJECTED) {
                set[`statusHistory.${lastIndex}.stepCode`] = RESERVED_STEP_CODES.CANCELLED;
                set[`statusHistory.${lastIndex}.stepName`] = SIDE_STEP_NAMES[RESERVED_STEP_CODES.CANCELLED];
            }
            await Order.collection.updateOne({ _id: order._id }, { $set: set });
        }
        console.log(`Orders: ${cancelledByCustomer.length} customer cancellation(s) moved from REJECTED to CANCELLED.`);

        const renamed = await Order.collection.updateMany(
            { currentStepCode: RESERVED_STEP_CODES.REJECTED },
            { $set: { currentStepName: SIDE_STEP_NAMES[RESERVED_STEP_CODES.REJECTED] } }
        );
        console.log(`Orders: ${renamed.modifiedCount} admin rejection(s) renamed to "Rejected".`);

        await Order.collection.updateMany({ isPaymentAtDelivery: { $exists: false } }, { $set: { isPaymentAtDelivery: false } });

        // isFinalized from scratch: true only on the last step of the order's own template.
        await Order.collection.updateMany({}, { $set: { isFinalized: false } });
        const templates = await OrderStepMaster.collection.find({}, { projection: { steps: 1 } }).toArray();
        let finalizedCount = 0;
        for (const template of templates) {
            const steps = [...(template.steps || [])].sort((a, b) => a.sequence - b.sequence);
            const lastStep = steps[steps.length - 1];
            if (!lastStep) continue;
            const result = await Order.collection.updateMany(
                { orderStepMasterId: template._id, currentStepCode: lastStep.code },
                { $set: { isFinalized: true } }
            );
            finalizedCount += result.modifiedCount;
        }
        console.log(`Orders: ${finalizedCount} order(s) on the last step of their workflow marked finalized.`);
    } catch (err) {
        throw err;
    }
};

const migrateInvoiceIndex = async () => {
    try {
        const indexes = await Invoice.collection.indexes();
        const old = indexes.find((index) => index.name === 'vendorId_1_orderId_1');
        if (old && old.unique && !old.partialFilterExpression) {
            await Invoice.collection.dropIndex('vendorId_1_orderId_1');
            console.log('Invoice: dropped the old one-invoice-per-order index.');
        } else {
            console.log('Invoice: no old index to drop.');
        }
        // createIndexes (not syncIndexes) so this only ever ADDS indexes.
        await Invoice.createIndexes();
        console.log('Invoice: indexes created.');
    } catch (err) {
        throw err;
    }
};

const migrateCompanySettings = async () => {
    try {
        const settingsList = await CompanySettings.collection.find(
            { $or: STEP_SETTING_FIELDS.map((field) => ({ [field]: { $nin: [null, ''] } })) },
            { projection: { vendorId: 1, ...Object.fromEntries(STEP_SETTING_FIELDS.map((field) => [field, 1])) } }
        ).toArray();

        const clearedVendorIds = [];
        for (const settings of settingsList) {
            const companyMaster = await CompanyMaster.findOne({ vendorId: settings.vendorId }).select('orderSteps').lean();
            const template = companyMaster?.orderSteps ? await OrderStepMaster.collection.findOne({ _id: companyMaster.orderSteps }) : null;
            const codes = (template?.steps || []).map((step) => step.code);

            const unset = {};
            for (const field of STEP_SETTING_FIELDS) {
                if (settings[field] && !codes.includes(settings[field])) {
                    unset[field] = null;
                    console.log(`Company Settings: vendor ${settings.vendorId} - cleared ${field}="${settings[field]}" (not in its workflow).`);
                }
            }
            // The delivery-agent step change is a pair: clearing one half clears both.
            if (unset.deliveryAgentFromStep !== undefined || unset.deliveryAgentToStep !== undefined) {
                unset.deliveryAgentFromStep = null;
                unset.deliveryAgentToStep = null;
            }
            if (Object.keys(unset).length > 0) {
                await CompanySettings.collection.updateOne({ _id: settings._id }, { $set: unset });
                clearedVendorIds.push(settings.vendorId);
            }
        }
        console.log(`Company Settings: ${clearedVendorIds.length} vendor(s) had stale order step settings cleared.`);
        return clearedVendorIds;
    } catch (err) {
        throw err;
    }
};

const migrateWebsiteMaster = async () => {
    try {
        const result = await WebsiteMaster.collection.updateMany(
            { isOrderStatusUpdationAllowedByDeliveryAgents: { $exists: false } },
            { $set: { isOrderStatusUpdationAllowedByDeliveryAgents: true } }
        );
        console.log(`WebsiteMaster: delivery-agent switch turned on in ${result.modifiedCount} document(s) where it wasn't set.`);
        return result.modifiedCount > 0;
    } catch (err) {
        throw err;
    }
};

async function migrateOrderStepWorkflow() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        await migrateTemplates();
        await migrateOrders();
        await migrateInvoiceIndex();
        const clearedVendorIds = await migrateCompanySettings();
        const websiteMasterChanged = await migrateWebsiteMaster();

        // The cached copies (ensureVendorDataCached) must not keep serving the old values.
        if (process.env.IS_REDIS_SERVER_ON === '1' && (clearedVendorIds.length > 0 || websiteMasterChanged)) {
            await connectRedis();
            for (const vendorId of clearedVendorIds) {
                await redisService.del(redisKeys.companySettings(vendorId.toString()));
            }
            if (websiteMasterChanged) {
                await redisService.del(redisKeys.websiteMaster());
            }
            console.log('Cleared the affected Redis cache entries.');
        }

        console.log('Order step workflow migration finished.');
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

migrateOrderStepWorkflow();
