const paymentService = require('../services/paymentService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const initiateOnlinePayment = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isPaymentGatewayFeatureOn', 'isPaymentGatewayFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await paymentService.initiateOnlinePayment(
            vendorId, req.user._id, req.params.orderId, req.vendorData?.domain,
            websiteMasterData, companyMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('paymentController: initiateOnlinePayment - Exception while initiating online payment', { vendorId, error });
    }
};

const selectCashOnDelivery = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isCODFeatureOn', 'isCODFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await paymentService.selectCashOnDelivery(vendorId, req.user._id, req.params.orderId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('paymentController: selectCashOnDelivery - Exception while selecting cash on delivery', { vendorId, error });
    }
};

const getPaymentStatus = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await paymentService.getPaymentStatus(vendorId, req.user._id, req.params.orderId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('paymentController: getPaymentStatus - Exception while fetching payment status', { vendorId, error });
    }
};

// Public webhook - called server-to-server by the gateway itself, never by
// a logged-in user, so there is no req.user here. req.vendorId still comes
// from vendorDetection (this route is hit on the vendor's own domain, same
// as every other route - see server.js).
const handleGatewayCallback = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await paymentService.handleGatewayCallback(vendorId, req.params.gateway, req.body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('paymentController: handleGatewayCallback - Exception while handling gateway callback', { vendorId, error });
    }
};

module.exports = {
    initiateOnlinePayment,
    selectCashOnDelivery,
    getPaymentStatus,
    handleGatewayCallback
};
