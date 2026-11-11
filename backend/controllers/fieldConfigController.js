const fieldConfigService = require('../services/fieldConfigService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// The vendor's field configuration (hidden fields, renamed labels, custom
// fields) per entity - read once by the admin panel to draw its forms/lists.
const getFieldConfigAdmin = async (req, res) => {
    try {
        const result = await fieldConfigService.fetchFieldConfigForAdmin(req.vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('fieldConfigController: getFieldConfigAdmin - Exception while fetching field config', { vendorId: req.vendorId, error });
    }
};

module.exports = {
    getFieldConfigAdmin
};
