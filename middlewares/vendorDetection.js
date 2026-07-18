const Vendor = require('../models/Vendor');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const vendorDetection = async (req, res, next) => {
    try {
        const domain = req.hostname.toLowerCase();
        const vendor = await Vendor.findOne({ domain, isActive: true });
        if (!vendor) {
            logger.logInfo(`Vendor not found and hostname is ${req.hostname}`)
            return common.sendError(res, 404, `Store not found. Please check the domain.`)               
        }
        // console.log(`I am talking from vendor detection middleware and vendor ID is ${vendor._id}`)
        req.vendorId = vendor._id;
        req.vendorData = vendor;
        next();
    } catch (error) {
        logger.logException("Exception in vendorDetection middleware", error);
        res.status(500).json({
            success: false,
            message: 'Server error during vendor detection'
        });
    }
};

module.exports = vendorDetection;