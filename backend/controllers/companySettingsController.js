const companySettingsService = require('../services/companySettingsService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const createCompanySettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const companyMasterData = req.companyMasterData;
        const websiteMasterData = req.websiteMasterData;

        const result = await companySettingsService.createCompanySettings(
            vendorId, req.user._id, req.body, req.files, companyMasterData, websiteMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.settings);
    } catch (error) {
        logger.logException('companySettingsController: createCompanySettings - Exception while creating company settings', { vendorId, error });
    }
};

const updateCompanySettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const hasBodyFields = Object.keys(req.body || {}).length > 0;
        const hasFiles = !!(req.files?.companyLogo?.[0] || req.files?.paymentScanner?.[0]);
        if (!hasBodyFields && !hasFiles) {
            return common.sendError(res, 400, 'At least one field or file must be provided for update');
        }

        const companyMasterData = req.companyMasterData;
        const websiteMasterData = req.websiteMasterData;

        const result = await companySettingsService.updateCompanySettings(
            vendorId, req.user._id, req.body, req.files, companyMasterData, websiteMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.settings);
    } catch (error) {
        logger.logException('companySettingsController: updateCompanySettings - Exception while updating company settings', { vendorId, error });
    }
};

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
  createCompanySettings,
  updateCompanySettings,
  getCompanySettings,
  assignEmailTemplate,
  unassignEmailTemplate
};