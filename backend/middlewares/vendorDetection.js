const Vendor = require('../models/Vendor');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// The storefront domain a request was made on. Normally req.hostname (which,
// with 'trust proxy' on, is the X-Forwarded-Host the frontend host sends).
// If a proxy in between drops that header the request arrives on the
// backend's own address instead (RENDER_EXTERNAL_HOSTNAME, set by Render
// itself) - only then DEFAULT_VENDOR_DOMAIN is used, when it is set.
const resolveRequestDomain = (req) => {
    try {
        const hostname = req.hostname.toLowerCase();
        const backendOwnHostname = (process.env.RENDER_EXTERNAL_HOSTNAME || '').trim().toLowerCase();
        const defaultVendorDomain = (process.env.DEFAULT_VENDOR_DOMAIN || '').trim().toLowerCase();

        if (defaultVendorDomain && backendOwnHostname && hostname === backendOwnHostname) {
            return defaultVendorDomain;
        }
        return hostname;
    } catch (error) {
        throw error;
    }
};

const vendorDetection = async (req, res, next) => {
    try {
        const domain = resolveRequestDomain(req);
        const vendor = await Vendor.findOne({ domain, isActive: true });
        if (!vendor) {
            logger.logInfo(0,1,`Vendor not found and hostname is ${req.hostname}`)
            return common.sendError(res, 404, `Store not found. Please check the domain.`)
        }
        req.vendorId = vendor._id;
        req.vendorData = vendor;
        next();
    } catch (error) {
        // Answers the request with a 500 + error reference itself.
        logger.logException("Exception in vendorDetection middleware", error);
    }
};

module.exports = vendorDetection;
