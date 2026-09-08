const emailTemplateMasterService = require('../services/emailTemplateMasterService');
const { EMAIL_MODULE_VARIABLES } = require('../constants/emailVariableConstants');
const logger = require('../utils/logger');
const common = require('../utils/common');

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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.template);
    } catch (error) {
        logger.logException('emailTemplateMasterController: addTemplate - Exception while adding email template', { vendorId, error });
    }
};

const updateTemplate = async (req, res) => {
    const vendorId = req.vendorId;
    const { templateId } = req.body;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await emailTemplateMasterService.updateTemplate(vendorId, templateId, req.body, req.user._id, companyMasterData, websiteMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.template);
    } catch (error) {
        logger.logException('emailTemplateMasterController: updateTemplate - Exception while updating email template', { vendorId, templateId, error });
    }
};

const deleteTemplate = async (req, res) => {
    const vendorId = req.vendorId;
    const { templateId } = req.body;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isEmailTemplateFeatureOn', 'isEmailTemplateFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

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

        const result = await emailTemplateMasterService.fetchAllTemplatesAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.templates);
    } catch (error) {
        logger.logException('emailTemplateMasterController: getAllTemplatesAdmin - Exception while fetching email templates', { vendorId, error });
    }
};

const getTemplateById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await emailTemplateMasterService.fetchTemplateById(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.template);
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

module.exports = {
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getAllTemplatesAdmin,
    getTemplateById,
    getAvailableVariables
};
