const storeAvailabilityService = require('../services/storeAvailabilityService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const {
    STORE_STATUS_HTTP_CODE,
    STORE_STATUS_MESSAGE,
    STORE_STATUS_ERROR_FIELD
} = require('../constants/storeAvailabilityConstants');

// Refuses API calls while the vendor's store is closed - under maintenance
// (503) or its plan has expired (403) - so nobody keeps using the storefront
// or the admin panel by calling the API directly. Must run after
// vendorDetection + ensureVendorDataCached: it reads req.websiteMasterData and
// req.companyMasterData off the request rather than re-fetching them.
const checkStoreAvailability = (req, res, next) => {
    try {
        if (!storeAvailabilityService.isPathBlockedWhenClosed(req.path)) {
            return next();
        }

        const status = storeAvailabilityService.resolveStoreStatus(req.websiteMasterData, req.companyMasterData);
        if (!status) {
            return next();
        }

        logger.logInfo(0, 1, 'Request refused - store is closed', { status, path: req.path });
        return common.sendError(res, STORE_STATUS_HTTP_CODE[status], STORE_STATUS_MESSAGE[status], [
            { field: STORE_STATUS_ERROR_FIELD, message: status }
        ]);
    } catch (error) {
        // Answers the request with a 500 + error reference itself.
        logger.logException('Exception in checkStoreAvailability middleware', error);
    }
};

module.exports = checkStoreAvailability;
