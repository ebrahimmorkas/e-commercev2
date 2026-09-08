const EmailTemplateMaster = require('../models/EmailTemplateMaster');
const DefaultEmailTemplateMaster = require('../models/DefaultEmailTemplateMaster');
const CompanySettings = require('../models/CompanySettings');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const { validateContentRules } = require('./emailService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Resolves which template content a given vendor+module should actually
// send with. Order of precedence:
//   1. The vendor's own template, IF they have isEmailTemplateFeatureOn AND
//      have tagged one for this module in CompanySettings.emailTemplateAssignments
//      AND that template still exists and is active.
//   2. The platform-owned DefaultEmailTemplateMaster for this module.
//   3. Neither exists -> isSuccess: false (caller should skip sending).
// This single function is what makes "vendor has email but not templates"
// and "vendor has templates but hasn't tagged this module yet" collapse into
// the same fallback behavior - both just fall through to step 2.
const resolveTemplateForModule = async (vendorId, module, companyMasterData, companySettingsData) => {
    try {
        if (companyMasterData && companyMasterData.isEmailTemplateFeatureOn && companySettingsData && Array.isArray(companySettingsData.emailTemplateAssignments)) {
            const assignment = companySettingsData.emailTemplateAssignments.find((a) => a.module === module);
            if (assignment && assignment.templateId) {
                const vendorTemplate = await EmailTemplateMaster.findOne({ _id: assignment.templateId, vendorId, status: 'A' });
                if (vendorTemplate) {
                    return common.returnResult(true, 200, "Vendor's tagged template resolved", { template: vendorTemplate, isDefault: false });
                }
            }
        }

        const defaultTemplate = await DefaultEmailTemplateMaster.findOne({ module, status: 'A' });
        if (defaultTemplate) {
            return common.returnResult(true, 200, 'Platform default template resolved', { template: defaultTemplate, isDefault: true });
        }

        return common.returnResult(false, 404, 'No email template configured for this module.');
    } catch (err) {
        throw err;
    }
};

// Strips any CompanySettings.emailTemplateAssignments entry pointing at
// templateId - called whenever a template stops being usable (deleted, or
// deactivated to status 'I'). Not strictly required for correctness -
// resolveTemplateForModule's status:'A' filter already falls back safely on
// its own - but leaves no dangling reference behind for anything that reads
// the assignments array directly (a future admin UI, support tooling, etc.).
const removeTemplateAssignments = async (vendorId, templateId) => {
    const settings = await CompanySettings.findOne({ vendorId });
    if (!settings) {
        return;
    }

    const hadAssignment = settings.emailTemplateAssignments.some((a) => a.templateId.toString() === templateId.toString());
    if (!hadAssignment) {
        return;
    }

    settings.emailTemplateAssignments = settings.emailTemplateAssignments.filter((a) => a.templateId.toString() !== templateId.toString());
    await settings.save();
    await redisService.del(redisKeys.companySettings(vendorId));
};

const getTemplateCount = async (vendorId) => {
    try {
        const count = await EmailTemplateMaster.countDocuments({ vendorId, status: { $ne: 'D' } });
        return common.returnResult(true, 200, 'Template count fetched successfully', { count });
    } catch (err) {
        throw err;
    }
};

const addTemplate = async (vendorId, templateData, userId, companyMasterData, websiteMasterData) => {
    try {
        const { templateName, module, subject, htmlBody, textBody } = templateData;
        const trimmedName = templateName.trim();

        const nameExists = await EmailTemplateMaster.exists({
            vendorId,
            templateName: trimmedName,
            status: { $ne: 'D' }
        });
        if (nameExists) {
            return common.returnResult(false, 409, `Template "${trimmedName}" already exists.`);
        }

        // Same content rules (links/formatting) enforced at send time via
        // emailService.sendEmail() are enforced here too, so a violation is
        // caught when the template is authored rather than only when it's
        // eventually used to send.
        const contentCheck = validateContentRules({ html: htmlBody, text: textBody, companyMasterData, websiteMasterData });
        if (!contentCheck.isSuccess) {
            return contentCheck;
        }

        const template = new EmailTemplateMaster({
            vendorId,
            templateName: trimmedName,
            module: module || null,
            subject,
            htmlBody,
            textBody: textBody || null,
            createdBy: userId
        });

        const saved = await template.save();

        logger.logInfo(1, 0, 'Email template added successfully', { vendorId, templateId: saved._id });
        return common.returnResult(true, 201, 'Email template added successfully', { template: saved });
    } catch (err) {
        throw err;
    }
};

const updateTemplate = async (vendorId, templateId, updateData, userId, companyMasterData, websiteMasterData) => {
    try {
        const template = await EmailTemplateMaster.findOne({ _id: templateId, vendorId, status: { $ne: 'D' } });
        if (!template) {
            return common.returnResult(false, 404, 'Email template not found');
        }

        const { templateName, module, subject, htmlBody, textBody, status } = updateData;

        if (templateName !== undefined) {
            const trimmedName = templateName.trim();
            const nameExists = await EmailTemplateMaster.exists({
                vendorId,
                templateName: trimmedName,
                status: { $ne: 'D' },
                _id: { $ne: templateId }
            });
            if (nameExists) {
                return common.returnResult(false, 409, `Template "${trimmedName}" already exists.`);
            }
            template.templateName = trimmedName;
        }

        if (module !== undefined) {
            template.module = module || null;
        }

        if (subject !== undefined) {
            template.subject = subject;
        }

        if (htmlBody !== undefined || textBody !== undefined) {
            const contentCheck = validateContentRules({
                html: htmlBody !== undefined ? htmlBody : template.htmlBody,
                text: textBody !== undefined ? textBody : template.textBody,
                companyMasterData,
                websiteMasterData
            });
            if (!contentCheck.isSuccess) {
                return contentCheck;
            }
            if (htmlBody !== undefined) template.htmlBody = htmlBody;
            if (textBody !== undefined) template.textBody = textBody || null;
        }

        if (status !== undefined && status !== template.status) {
            if (status === 'A') {
                template.activeMarkedBy = userId;
                template.activeMarkedDate = new Date();
            } else if (status === 'I') {
                template.inActiveMarkeddBy = userId;
                template.inactiveMarkedDate = new Date();
                await removeTemplateAssignments(vendorId, templateId);
            }
            template.status = status;
        }

        template.updatedBy = userId;

        const updated = await template.save();
        logger.logInfo(1, 0, 'Email template updated successfully', { vendorId, templateId });
        return common.returnResult(true, 200, 'Email template updated successfully', { template: updated });
    } catch (err) {
        throw err;
    }
};

const softDeleteTemplate = async (vendorId, templateId, userId) => {
    try {
        const template = await EmailTemplateMaster.findOne({ _id: templateId, vendorId, status: { $ne: 'D' } });
        if (!template) {
            return common.returnResult(false, 404, 'Email template not found');
        }

        template.status = 'D';
        template.deletedBy = userId;
        await template.save();

        await removeTemplateAssignments(vendorId, templateId);

        logger.logInfo(1, 0, 'Email template deleted successfully', { vendorId, templateId });
        return common.returnResult(true, 200, 'Email template deleted successfully', {});
    } catch (err) {
        throw err;
    }
};

const fetchAllTemplatesAdmin = async (vendorId) => {
    try {
        const templates = await EmailTemplateMaster.find(
            { vendorId, status: { $in: ['A', 'I'] } },
            null,
            { sort: { templateName: 1 } }
        );
        return common.returnResult(true, 200, 'Email templates fetched successfully', { templates });
    } catch (err) {
        throw err;
    }
};

const fetchTemplateById = async (vendorId, templateId) => {
    try {
        const template = await EmailTemplateMaster.findOne({ _id: templateId, vendorId, status: { $ne: 'D' } });
        if (!template) {
            return common.returnResult(false, 404, 'Email template not found');
        }
        return common.returnResult(true, 200, 'Email template fetched successfully', { template });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    resolveTemplateForModule,
    getTemplateCount,
    addTemplate,
    updateTemplate,
    softDeleteTemplate,
    fetchAllTemplatesAdmin,
    fetchTemplateById
};
