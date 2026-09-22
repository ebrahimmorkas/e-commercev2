const companySettingsService = require('../services/companySettingsService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// companyLogo/paymentScanner/partnerCertificate each hold { url, imageAssetId }.
const encodeNestedImage = (field) => {
    if (!field) return field;
    return { ...field, imageAssetId: field.imageAssetId ? common.encodeId(field.imageAssetId) : field.imageAssetId };
};

// createdBy/updatedBy here are non-standard: { userID, vendorID } (capital
// ID), not the app-wide audit boilerplate.
const encodeAuditSubfield = (field) => {
    if (!field) return field;
    return {
        ...field,
        userID: field.userID ? common.encodeId(field.userID) : field.userID,
        vendorID: field.vendorID ? common.encodeId(field.vendorID) : field.vendorID,
    };
};

// Converts a CompanySettings mongoose doc into a response-safe object with
// every ObjectId field encoded via common.encodeId.
const formatCompanySettingsForResponse = (doc) => {
    if (!doc) return doc;
    const settings = doc.toObject ? doc.toObject() : doc;

    return {
        ...settings,
        _id: settings._id ? common.encodeId(settings._id) : settings._id,
        vendorId: settings.vendorId ? common.encodeId(settings.vendorId) : settings.vendorId,
        currencyId: settings.currencyId ? common.encodeId(settings.currencyId) : settings.currencyId,
        storeCountryId: settings.storeCountryId ? common.encodeId(settings.storeCountryId) : settings.storeCountryId,
        storeStateId: settings.storeStateId ? common.encodeId(settings.storeStateId) : settings.storeStateId,
        companyLogo: encodeNestedImage(settings.companyLogo),
        paymentScanner: encodeNestedImage(settings.paymentScanner),
        partnerCertificate: encodeNestedImage(settings.partnerCertificate),
        createdBy: encodeAuditSubfield(settings.createdBy),
        updatedBy: encodeAuditSubfield(settings.updatedBy),
        emailTemplateAssignments: (settings.emailTemplateAssignments || []).map((entry) => ({
            ...entry,
            templateId: entry.templateId ? common.encodeId(entry.templateId) : entry.templateId,
        })),
    };
};

// currencyId/storeCountryId/storeStateId are dropdown-sourced FK fields -
// decode when present (both create and update send them optionally).
const decodeCompanySettingsRefFields = (payload) => {
    const decoded = { ...payload };
    if (decoded.currencyId) decoded.currencyId = common.decodeId(decoded.currencyId);
    if (decoded.storeCountryId) decoded.storeCountryId = common.decodeId(decoded.storeCountryId);
    if (decoded.storeStateId) decoded.storeStateId = common.decodeId(decoded.storeStateId);
    return decoded;
};

const createCompanySettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const companyMasterData = req.companyMasterData;
        const websiteMasterData = req.websiteMasterData;

        const payload = decodeCompanySettingsRefFields(req.body);
        const result = await companySettingsService.createCompanySettings(
            vendorId, req.user._id, payload, req.files, companyMasterData, websiteMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatCompanySettingsForResponse(result.meta.settings));
    } catch (error) {
        logger.logException('companySettingsController: createCompanySettings - Exception while creating company settings', { vendorId, error });
    }
};

const updateCompanySettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const hasBodyFields = Object.keys(req.body || {}).length > 0;
        const hasFiles = !!(req.files?.companyLogo?.[0] || req.files?.paymentScanner?.[0] || req.files?.partnerCertificate?.[0]);
        if (!hasBodyFields && !hasFiles) {
            return common.sendError(res, 400, 'At least one field or file must be provided for update');
        }

        const companyMasterData = req.companyMasterData;
        const websiteMasterData = req.websiteMasterData;

        const payload = decodeCompanySettingsRefFields(req.body);
        const result = await companySettingsService.updateCompanySettings(
            vendorId, req.user._id, payload, req.files, companyMasterData, websiteMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatCompanySettingsForResponse(result.meta.settings));
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
    return common.sendSuccess(res, 200, "Company settings fetched successfully", formatCompanySettingsForResponse(settings));
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

    // templateId refers to EmailTemplateMaster, which is now common.encodeId-
    // encoded - decode it here even though the rest of CompanySettings isn't
    // rolled out yet, so assigning a template to a module doesn't break.
    const { module } = req.body;
    const templateId = common.decodeId(req.body.templateId);
    const result = await companySettingsService.assignEmailTemplate(vendorId, module, templateId, req.user._id);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, formatCompanySettingsForResponse(result.meta.settings));
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
    return common.sendSuccess(res, result.statusCode, result.message, formatCompanySettingsForResponse(result.meta.settings));
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