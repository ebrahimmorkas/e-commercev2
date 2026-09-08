const CompanySettings = require('../models/CompanySettings');
const EmailTemplateMaster = require('../models/EmailTemplateMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');

const fetchCompanySettingsByVendorId = async (vendorId) => {
    try {
        logger.logInfo(null,null,'Fetching company settings from DB', { vendorId });
        const settings = await CompanySettings.findOne({ vendorId });
        if (!settings) {
            logger.logInfo(0,1,'Company settings not found', { vendorId });
            return null;
        }
        logger.logInfo(1,0,'Company settings fetched successfully', { vendorId });
        return settings;
    } catch (err) {
        throw err;
    }
}

// Tags the vendor's own templateId against `module` - at most one entry per
// module (replaces any existing entry for that module). Invalidates the
// Redis cache afterwards so ensureVendorDataCached picks up the change on
// the very next request instead of serving stale companySettingsData for
// up to an hour.
const assignEmailTemplate = async (vendorId, module, templateId, userId) => {
    try {
        const template = await EmailTemplateMaster.findOne({ _id: templateId, vendorId, status: { $ne: 'D' } });
        if (!template) {
            return common.returnResult(false, 404, 'Email template not found');
        }

        const settings = await CompanySettings.findOne({ vendorId });
        if (!settings) {
            return common.returnResult(false, 404, 'Company settings not found');
        }

        settings.emailTemplateAssignments = settings.emailTemplateAssignments.filter((a) => a.module !== module);
        settings.emailTemplateAssignments.push({ module, templateId });
        settings.updatedBy = { userID: userId, vendorID: vendorId };

        await settings.save();
        await redisService.del(redisKeys.companySettings(vendorId));

        logger.logInfo(1, 0, 'Email template assigned to module', { vendorId, module, templateId });
        return common.returnResult(true, 200, 'Email template assigned successfully', { settings });
    } catch (err) {
        throw err;
    }
};

const unassignEmailTemplate = async (vendorId, module, userId) => {
    try {
        const settings = await CompanySettings.findOne({ vendorId });
        if (!settings) {
            return common.returnResult(false, 404, 'Company settings not found');
        }

        settings.emailTemplateAssignments = settings.emailTemplateAssignments.filter((a) => a.module !== module);
        settings.updatedBy = { userID: userId, vendorID: vendorId };

        await settings.save();
        await redisService.del(redisKeys.companySettings(vendorId));

        logger.logInfo(1, 0, 'Email template unassigned from module', { vendorId, module });
        return common.returnResult(true, 200, 'Email template unassigned successfully', { settings });
    } catch (err) {
        throw err;
    }
};

module.exports = {
  fetchCompanySettingsByVendorId,
  assignEmailTemplate,
  unassignEmailTemplate
};