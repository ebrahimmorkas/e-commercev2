const mongoose = require('mongoose');
const freeCashUsageService = require('../services/freeCashUsageService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const { FREE_CASH_FEATURE_FLAG } = require('../constants/freeCashUsageConstants');

const checkFreeCashFeature = async (req) => {
    try {
        return await common.checkFeatureOnOrOff(req.vendorId, req.websiteMasterData, req.companyMasterData, FREE_CASH_FEATURE_FLAG, FREE_CASH_FEATURE_FLAG);
    } catch (err) {
        throw err;
    }
};

const encodeIfPresent = (id) => {
    try {
        return id ? common.encodeId(id) : null;
    } catch (err) {
        throw err;
    }
};

// A customer row / the customer of a history, with the id encoded via common.encodeId.
const formatCustomerForResponse = (customer) => {
    try {
        if (!customer) return customer;
        return { ...customer, _id: encodeIfPresent(customer._id) };
    } catch (err) {
        throw err;
    }
};

const formatFreeCashForResponse = (freeCash) => {
    try {
        return {
            ...freeCash,
            userFreeCashId: encodeIfPresent(freeCash.userFreeCashId),
            freeCashId: encodeIfPresent(freeCash.freeCashId)
        };
    } catch (err) {
        throw err;
    }
};

const formatEventForResponse = (event) => {
    try {
        return {
            ...event,
            userFreeCashId: encodeIfPresent(event.userFreeCashId),
            freeCashId: encodeIfPresent(event.freeCashId),
            ...(event.orderId !== undefined ? { orderId: encodeIfPresent(event.orderId) } : {})
        };
    } catch (err) {
        throw err;
    }
};

const getCustomersFreeCash = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkFreeCashFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await freeCashUsageService.fetchCustomersFreeCash(vendorId, req.query);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            customers: result.meta.customers.map(formatCustomerForResponse)
        });
    } catch (error) {
        logger.logException('freeCashUsageController: getCustomersFreeCash - Exception while fetching Free Cash usage', { vendorId, error });
    }
};

const getCustomerFreeCashHistory = async (req, res) => {
    const vendorId = req.vendorId;
    let userId;
    try {
        const validityResult = await checkFreeCashFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        // A tampered / garbage id decodes to null (not a thrown error) -> 400.
        userId = common.tryDecodeId(req.params.userId);
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return common.sendError(res, 400, 'The selected customer is not valid. Please refresh the page and try again.');
        }

        const result = await freeCashUsageService.fetchCustomerFreeCashHistory(vendorId, userId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            customer: formatCustomerForResponse(result.meta.customer),
            activeFreeCash: result.meta.activeFreeCash,
            freeCash: result.meta.freeCash.map(formatFreeCashForResponse),
            events: result.meta.events.map(formatEventForResponse)
        });
    } catch (error) {
        logger.logException('freeCashUsageController: getCustomerFreeCashHistory - Exception while fetching Free Cash history', { vendorId, userId, error });
    }
};

module.exports = {
    getCustomersFreeCash,
    getCustomerFreeCashHistory
};
