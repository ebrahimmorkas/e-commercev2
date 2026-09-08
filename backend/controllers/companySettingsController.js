const companySettingsService = require('../services/companySettingsService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const getCompanySettings = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const settings = await companySettingsService.fetchCompanySettingsByVendorId(vendorId);
    if (!settings) {
      return common.sendError(res, 404, "Company settings not found");
    }
    return common.sendSuccess(res, 200, "Company settings fetched successfully", settings);
  } catch (error) {
    logger.logException('Error fetching company settings', { vendorId, error });
    return common.sendError(res, 500, "Failed to fetch company settings");
  }
};

const assignEmailTemplate = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const websiteMasterData = req.websiteMasterData;
    const companyMasterData = req.companyMasterData;
    const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
    if (!validityResult.isSuccess) {
      return common.sendError(res, validityResult.statusCode, validityResult.message);
    }

    const { module, templateId } = req.body;
    const result = await companySettingsService.assignEmailTemplate(vendorId, module, templateId, req.user._id);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta.settings);
  } catch (error) {
    logger.logException('companySettingsController: assignEmailTemplate - Exception while assigning email template', { vendorId, error });
  }
};

const unassignEmailTemplate = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const { module } = req.body;
    const result = await companySettingsService.unassignEmailTemplate(vendorId, module, req.user._id);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta.settings);
  } catch (error) {
    logger.logException('companySettingsController: unassignEmailTemplate - Exception while unassigning email template', { vendorId, error });
  }
};

module.exports = {
  getCompanySettings,
  assignEmailTemplate,
  unassignEmailTemplate
};