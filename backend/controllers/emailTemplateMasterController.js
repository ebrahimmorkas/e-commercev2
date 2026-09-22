const emailTemplateMasterService = require('../services/emailTemplateMasterService');
const { EMAIL_MODULE_VARIABLES } = require('../constants/emailVariableConstants');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Converts an EmailTemplateMaster mongoose doc into a response-safe object
// with every ObjectId field encoded via common.encodeId.
const formatTemplateForResponse = (templateDoc) => {
    if (!templateDoc) return templateDoc;
    const template = templateDoc.toObject ? templateDoc.toObject() : templateDoc;

    return {
        ...template,
        _id: template._id ? common.encodeId(template._id) : template._id,
        vendorId: template.vendorId ? common.encodeId(template.vendorId) : template.vendorId,
        createdBy: template.createdBy ? common.encodeId(template.createdBy) : template.createdBy,
        updatedBy: template.updatedBy ? common.encodeId(template.updatedBy) : template.updatedBy,
        deletedBy: template.deletedBy ? common.encodeId(template.deletedBy) : template.deletedBy,
        activeMarkedBy: template.activeMarkedBy ? common.encodeId(template.activeMarkedBy) : template.activeMarkedBy,
        inActiveMarkeddBy: template.inActiveMarkeddBy ? common.encodeId(template.inActiveMarkeddBy) : template.inActiveMarkeddBy,
    };
};

const addTemplate = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const { numberOfTemplatesAllowed } = companyMasterData;
        const existingCount = await emailTemplateMasterService.getTemplateCount(vendorId);
        if (numberOfTemplatesAllowed != null && existingCount.meta.count >= numberOfTemplatesAllowed) {
            return common.sendError(res, 403, 'You have exceeded the number of email templates allowed');
        }

        const result = await emailTemplateMasterService.addTemplate(vendorId, req.body, req.user._id, companyMasterData, websiteMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatTemplateForResponse(result.meta.template));
    } catch (error) {
        logger.logException('emailTemplateMasterController: addTemplate - Exception while adding email template', { vendorId, error });
    }
};

const updateTemplate = async (req, res) => {
    const vendorId = req.vendorId;
    let templateId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        templateId = common.decodeId(req.body.templateId);
        const payload = { ...req.body };
        delete payload.templateId;

        const result = await emailTemplateMasterService.updateTemplate(vendorId, templateId, payload, req.user._id, companyMasterData, websiteMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatTemplateForResponse(result.meta.template));
    } catch (error) {
        logger.logException('emailTemplateMasterController: updateTemplate - Exception while updating email template', { vendorId, templateId, error });
    }
};

const deleteTemplate = async (req, res) => {
    const vendorId = req.vendorId;
    let templateId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        templateId = common.decodeId(req.body.templateId);
        const result = await emailTemplateMasterService.softDeleteTemplate(vendorId, templateId, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('emailTemplateMasterController: deleteTemplate - Exception while deleting email template', { vendorId, templateId, error });
    }
};

const getAllTemplatesAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await emailTemplateMasterService.fetchAllTemplatesAdmin(vendorId, req.companySettingsData, companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            templates: result.meta.templates.map(formatTemplateForResponse),
            assignments: result.meta.assignments.map((a) => ({ ...a, templateId: common.encodeId(a.templateId) })),
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('emailTemplateMasterController: getAllTemplatesAdmin - Exception while fetching email templates', { vendorId, error });
    }
};

const getTemplateById = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await emailTemplateMasterService.fetchTemplateById(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatTemplateForResponse(result.meta.template));
    } catch (error) {
        logger.logException('emailTemplateMasterController: getTemplateById - Exception while fetching email template by id', { vendorId, id, error });
    }
};

const getAvailableVariables = async (req, res) => {
    const vendorId = req.vendorId;
    const { module } = req.params;
    try {
        const variables = EMAIL_MODULE_VARIABLES[module] || [];
        return common.sendSuccess(res, 200, 'Available variables fetched successfully', variables);
    } catch (error) {
        logger.logException('emailTemplateMasterController: getAvailableVariables - Exception while fetching available variables', { vendorId, module, error });
    }
};

const bulkSetTemplateStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { status } = req.body;
    try {
        const validityResult = await common.checkFeatureOnOrOff(vendorId, req.websiteMasterData, req.companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const decodedIds = req.body.templateIds.map((id) => common.decodeId(id));
        const result = await emailTemplateMasterService.bulkSetTemplateStatus(vendorId, req.user._id, decodedIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('emailTemplateMasterController: bulkSetTemplateStatus - Exception while bulk updating email template status', { vendorId, error });
    }
};

const bulkDeleteTemplates = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await common.checkFeatureOnOrOff(vendorId, req.websiteMasterData, req.companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const decodedIds = req.body.templateIds.map((id) => common.decodeId(id));
        const result = await emailTemplateMasterService.bulkDeleteTemplates(vendorId, req.user._id, decodedIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('emailTemplateMasterController: bulkDeleteTemplates - Exception while bulk deleting email templates', { vendorId, error });
    }
};

module.exports = {
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getAllTemplatesAdmin,
    getTemplateById,
    getAvailableVariables,
    bulkSetTemplateStatus,
    bulkDeleteTemplates
};
