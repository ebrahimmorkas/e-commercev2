const companySettingsService = require('../services/companySettingsService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// companyLogo/paymentScanner/partnerCertificate each hold { url, imageAssetId }.
const encodeNestedImage = (field) => {
    if (!field) return field;
    return { ...field, imageAssetId: field.imageAssetId ? common.encodeId(field.imageAssetId) : field.imageAssetId };
};

// emailAttachments / emailImages entries - their own _id (used to remove
// them) and the stored asset's id are encoded like every other id.
const encodeEmailContentEntry = (entry, assetField) => ({
    ...entry,
    _id: entry._id ? common.encodeId(entry._id) : entry._id,
    [assetField]: entry[assetField] ? common.encodeId(entry[assetField]) : entry[assetField],
});

const formatEmailContentLists = (lists) => ({
    emailAttachments: (lists.emailAttachments || []).map((entry) => encodeEmailContentEntry(entry, 'fileAssetId')),
    emailImages: (lists.emailImages || []).map((entry) => encodeEmailContentEntry(entry, 'imageAssetId')),
});

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
        storeCityId: settings.storeCityId ? common.encodeId(settings.storeCityId) : settings.storeCityId,
        companyLogo: encodeNestedImage(settings.companyLogo),
        paymentScanner: encodeNestedImage(settings.paymentScanner),
        partnerCertificate: encodeNestedImage(settings.partnerCertificate),
        createdBy: encodeAuditSubfield(settings.createdBy),
        updatedBy: encodeAuditSubfield(settings.updatedBy),
        emailTemplateAssignments: (settings.emailTemplateAssignments || []).map((entry) => ({
            ...entry,
            templateId: entry.templateId ? common.encodeId(entry.templateId) : entry.templateId,
        })),
        ...formatEmailContentLists(settings),
    };
};

// Every settings response also says what the Email tab may show (CC/BCC,
// attachments, images) and their limits - the page replaces its copy of the
// settings with each response, so this must travel with all of them.
const withEmailFeatureAccess = (req, formatted) => ({
    ...formatted,
    emailFeatureAccess: companySettingsService.getEmailFeatureAccess(req.companyMasterData, req.websiteMasterData),
});

// currencyId/storeCountryId/storeStateId/storeCityId are dropdown-sourced FK fields -
// decode when present (both create and update send them optionally).
const decodeCompanySettingsRefFields = (payload) => {
    const decoded = { ...payload };
    if (decoded.currencyId) decoded.currencyId = common.decodeId(decoded.currencyId);
    if (decoded.storeCountryId) decoded.storeCountryId = common.decodeId(decoded.storeCountryId);
    if (decoded.storeStateId) decoded.storeStateId = common.decodeId(decoded.storeStateId);
    if (decoded.storeCityId) decoded.storeCityId = common.decodeId(decoded.storeCityId);
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
        return common.sendSuccess(res, result.statusCode, result.message, withEmailFeatureAccess(req, formatCompanySettingsForResponse(result.meta.settings)));
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
        return common.sendSuccess(res, result.statusCode, result.message, withEmailFeatureAccess(req, formatCompanySettingsForResponse(result.meta.settings)));
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
    return common.sendSuccess(res, 200, "Company settings fetched successfully", withEmailFeatureAccess(req, formatCompanySettingsForResponse(settings)));
  } catch (error) {
    logger.logException('Error fetching company settings', { vendorId, error });
  }
};

// The steps of the order workflow assigned to this vendor - what the order
// step settings (cancellation cutoff, payment step, delivery agent step
// change) can be set to.
const getAssignedOrderSteps = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const result = await companySettingsService.fetchAssignedOrderSteps(req.companyMasterData, req.websiteMasterData);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('companySettingsController: getAssignedOrderSteps - Exception while fetching order steps', { vendorId, error });
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
    return common.sendSuccess(res, result.statusCode, result.message, withEmailFeatureAccess(req, formatCompanySettingsForResponse(result.meta.settings)));
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
    return common.sendSuccess(res, result.statusCode, result.message, withEmailFeatureAccess(req, formatCompanySettingsForResponse(result.meta.settings)));
  } catch (error) {
    logger.logException('companySettingsController: unassignEmailTemplate - Exception while unassigning email template', { vendorId, error });
  }
};

// --- Email tab: attachments and images -------------------------------------

const addEmailAttachment = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const result = await companySettingsService.addEmailAttachment(
      vendorId, req.user._id, req.file, req.body.displayName, req.companyMasterData, req.websiteMasterData
    );
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, formatEmailContentLists(result.meta));
  } catch (error) {
    logger.logException('companySettingsController: addEmailAttachment - Exception while adding email attachment', { vendorId, error });
  }
};

const removeEmailAttachment = async (req, res) => {
  const vendorId = req.vendorId;
  let attachmentId;
  try {
    attachmentId = common.decodeId(req.params.id);
    const result = await companySettingsService.removeEmailAttachment(vendorId, req.user._id, attachmentId);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, formatEmailContentLists(result.meta));
  } catch (error) {
    logger.logException('companySettingsController: removeEmailAttachment - Exception while removing email attachment', { vendorId, attachmentId, error });
  }
};

const addEmailImage = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const result = await companySettingsService.addEmailImage(
      vendorId, req.user._id, req.file, req.body.name, req.companyMasterData, req.websiteMasterData
    );
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, formatEmailContentLists(result.meta));
  } catch (error) {
    logger.logException('companySettingsController: addEmailImage - Exception while adding email image', { vendorId, error });
  }
};

const removeEmailImage = async (req, res) => {
  const vendorId = req.vendorId;
  let imageId;
  try {
    imageId = common.decodeId(req.params.id);
    const result = await companySettingsService.removeEmailImage(vendorId, req.user._id, imageId);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, formatEmailContentLists(result.meta));
  } catch (error) {
    logger.logException('companySettingsController: removeEmailImage - Exception while removing email image', { vendorId, imageId, error });
  }
};

module.exports = {
  addEmailAttachment,
  removeEmailAttachment,
  addEmailImage,
  removeEmailImage,
  createCompanySettings,
  updateCompanySettings,
  getCompanySettings,
  getAssignedOrderSteps,
  assignEmailTemplate,
  unassignEmailTemplate
};