const EmailTemplateMaster = require('../models/EmailTemplateMaster');
const DefaultEmailTemplateMaster = require('../models/DefaultEmailTemplateMaster');
const CompanySettings = require('../models/CompanySettings');
const FileAsset = require('../models/FileAsset');
const ImageAsset = require('../models/ImageAsset');
const { readStoredAsset } = require('./storedFileReader');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const { validateContentRules } = require('./emailService');
const orderStepService = require('./orderStepService');
const { EMAIL_MODULES, VALID_EMAIL_MODULES, MODULE_REQUIRED_FEATURE, getEmailModuleLabel } = require('../constants/emailModuleConstants');
const { SIDE_STEP_NAMES } = require('../constants/orderStepConstants');
const logger = require('../utils/logger');
const common = require('../utils/common');

const STEP_WISE_ORDER_TEMPLATES_FLAG = 'isDifferentEmailTemplatesForOrderStepsOn';

// How the vendor picked the order steps for a template (step-wise mode only).
// ALL/REMAINING are expanded into a fixed list of step codes when saved.
const STEP_SELECTIONS = {
    ALL: 'ALL',
    REMAINING: 'REMAINING',
    CUSTOM: 'CUSTOM'
};

const isSameId = (a, b) => a != null && b != null && String(a) === String(b);

// A step entry covers specific order steps; an entry without stepCodes is a
// "whole module" entry (see CompanySettings.emailTemplateAssignments).
const isStepEntry = (assignment) => Array.isArray(assignment.stepCodes) && assignment.stepCodes.length > 0;

// Plain yes/no versions of common.checkFeatureOnOrOff (which needs both
// master documents to be present) - website AND company flag must be on.
const isStepWiseOrderTemplatesOn = (websiteMasterData, companyMasterData) => {
    try {
        return websiteMasterData?.[STEP_WISE_ORDER_TEMPLATES_FLAG] === true && companyMasterData?.[STEP_WISE_ORDER_TEMPLATES_FLAG] === true;
    } catch (err) {
        throw err;
    }
};

const isCourierFeatureOn = (websiteMasterData, companyMasterData) => {
    try {
        return websiteMasterData?.isCourierFeatureOn === true && companyMasterData?.isCourierFeatureOn === true;
    } catch (err) {
        throw err;
    }
};

// A module that belongs to a feature (courier / discount / Free Cash - see
// MODULE_REQUIRED_FEATURE) only exists while that feature is on at BOTH levels.
const isModuleAvailable = (module, websiteMasterData, companyMasterData) => {
    try {
        const feature = MODULE_REQUIRED_FEATURE[module];
        if (!feature) return true;
        return websiteMasterData?.[feature] === true && companyMasterData?.[feature] === true;
    } catch (err) {
        throw err;
    }
};

// The modules to hide on the Email Templates page right now.
const getUnavailableModules = (websiteMasterData, companyMasterData) => {
    try {
        return VALID_EMAIL_MODULES.filter((module) => !isModuleAvailable(module, websiteMasterData, companyMasterData));
    } catch (err) {
        throw err;
    }
};

const checkModuleAllowed = (module, websiteMasterData, companyMasterData) => {
    try {
        if (module && !isModuleAvailable(module, websiteMasterData, companyMasterData)) {
            return common.returnResult(false, 403, `The ${getEmailModuleLabel(module)} module is not available because that feature is turned off for your account.`);
        }
        return common.returnResult(true, 200, 'Module allowed');
    } catch (err) {
        throw err;
    }
};

const isEmailTemplateFeatureOn = (websiteMasterData, companyMasterData) => {
    try {
        return websiteMasterData?.isEmailTemplateFeatureOn === true && companyMasterData?.isEmailTemplateFeatureOn === true;
    } catch (err) {
        throw err;
    }
};

// The order steps a vendor can pick for a template: their assigned workflow
// (CompanyMaster.orderSteps) in sequence, then the built-in side steps
// (Rejected/Cancelled/Refunded/Payment at Delivery), which send emails too.
const getOrderStepOptions = async (companyMasterData) => {
    try {
        const stepMaster = await orderStepService.loadActiveStepMaster(companyMasterData && companyMasterData.orderSteps);
        const flowSteps = orderStepService.getSortedSteps(stepMaster).map((step) => ({ code: step.code, name: step.name }));
        const sideSteps = Object.entries(SIDE_STEP_NAMES).map(([code, name]) => ({ code, name }));
        return { options: [...flowSteps, ...sideSteps], hasWorkflow: flowSteps.length > 0 };
    } catch (err) {
        throw err;
    }
};

// Resolves which template content a given vendor+module (and, for Order,
// the order step just reached) should send with:
//   1. The vendor's own assigned template, if the email template feature is
//      on. With step-wise order templates on, the Order module uses the step
//      entry covering `stepCode`, else the whole-module entry (which counts
//      as "every step no other template has"). If the module has templates
//      assigned but none covers this step, nothing is sent - the vendor chose
//      not to email for it.
//   2. No template assigned for the module at all -> the platform's
//      DefaultEmailTemplateMaster, unless CompanySettings.useDefaultEmailTemplate
//      is off, in which case nothing is sent.
// isSuccess: false = the caller should skip sending.
const resolveTemplateForModule = async (vendorId, module, companyMasterData, companySettingsData, websiteMasterData, stepCode) => {
    try {
        if (isEmailTemplateFeatureOn(websiteMasterData, companyMasterData)) {
            const assignments = (companySettingsData && companySettingsData.emailTemplateAssignments) || [];
            const moduleEntries = assignments.filter((a) => a.module === module);
            const isStepMode = module === EMAIL_MODULES.ORDER && isStepWiseOrderTemplatesOn(websiteMasterData, companyMasterData);

            const wholeModuleEntry = moduleEntries.find((a) => !isStepEntry(a));
            const entry = isStepMode
                ? moduleEntries.find((a) => isStepEntry(a) && a.stepCodes.includes(stepCode)) || wholeModuleEntry
                : wholeModuleEntry;
            const hasModuleTemplates = isStepMode ? moduleEntries.length > 0 : !!wholeModuleEntry;

            if (entry) {
                const vendorTemplate = await EmailTemplateMaster.findOne({ _id: entry.templateId, vendorId, status: 'A' });
                if (vendorTemplate) {
                    return common.returnResult(true, 200, "Vendor's assigned template resolved", { template: vendorTemplate, isDefault: false });
                }
            } else if (hasModuleTemplates) {
                return common.returnResult(false, 404, 'No email template is assigned to this order step.');
            }
        }

        if (companySettingsData && companySettingsData.useDefaultEmailTemplate === false) {
            return common.returnResult(false, 404, 'No email template is assigned to this module and the default email template is turned off.');
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

// Always read from the DB, not req.companySettingsData - the cached copy can
// be up to an hour stale and these checks decide whether to overwrite
// another template's assignment. null = the vendor has no CompanySettings
// document yet (nothing can be assigned until they save company settings).
const getTemplateAssignments = async (vendorId) => {
    try {
        const settings = await CompanySettings.findOne({ vendorId }, { emailTemplateAssignments: 1 }).lean();
        if (!settings) {
            return null;
        }
        return settings.emailTemplateAssignments || [];
    } catch (err) {
        throw err;
    }
};

// Writes the whole assignments array back in one targeted update rather
// than load-and-save(): save() revalidates every required field on the
// CompanySettings document, so an unrelated gap (e.g. a missing adminName)
// would block changing an assignment.
const saveTemplateAssignments = async (vendorId, assignments, userId) => {
    try {
        const update = { emailTemplateAssignments: assignments };
        if (userId) {
            update.updatedBy = { userID: userId, vendorID: vendorId };
        }
        await CompanySettings.updateOne({ vendorId }, { $set: update });
        await redisService.del(redisKeys.companySettings(vendorId));
    } catch (err) {
        throw err;
    }
};

// Removes templateId's assignment (whichever kind) - used when a template's
// module is cleared/changed and by the Unassign Module action. Deleting or
// deactivating an assigned template is refused outright (see
// assignedTemplateLockedResult), so the vendor always unassigns first.
const removeTemplateAssignments = async (vendorId, templateId) => {
    try {
        const assignments = await getTemplateAssignments(vendorId);
        if (!assignments || !assignments.some((a) => isSameId(a.templateId, templateId))) {
            return;
        }
        await saveTemplateAssignments(vendorId, assignments.filter((a) => !isSameId(a.templateId, templateId)));
    } catch (err) {
        throw err;
    }
};

// The module templateId is currently assigned to, or null. Counts a step
// entry even while step-wise templates are off, so a template can't be
// deleted out from under an assignment that comes back when it's turned on.
const getAssignedModuleOfTemplate = async (vendorId, templateId) => {
    try {
        const assignments = await getTemplateAssignments(vendorId);
        const assignment = (assignments || []).find((a) => isSameId(a.templateId, templateId));
        return assignment ? assignment.module : null;
    } catch (err) {
        throw err;
    }
};

// Everything the assignment checks for `module` need, loaded once.
const loadAssignmentContext = async (vendorId, module, companyMasterData, websiteMasterData) => {
    try {
        const assignments = await getTemplateAssignments(vendorId);
        const isStepMode = module === EMAIL_MODULES.ORDER && isStepWiseOrderTemplatesOn(websiteMasterData, companyMasterData);
        const stepOptions = isStepMode ? (await getOrderStepOptions(companyMasterData)).options : [];
        return { assignments, isStepMode, stepOptions };
    } catch (err) {
        throw err;
    }
};

// Which OTHER template currently sends each order step: a step entry that
// lists it, else another template's whole-module Order entry.
const buildStepCoverage = (assignments, templateId, stepOptions) => {
    try {
        const orderEntries = assignments.filter((a) => a.module === EMAIL_MODULES.ORDER && !isSameId(a.templateId, templateId));
        const wholeModuleEntry = orderEntries.find((a) => !isStepEntry(a));
        const coverage = {};
        stepOptions.forEach(({ code }) => {
            const holder = orderEntries.find((a) => isStepEntry(a) && a.stepCodes.includes(code)) || wholeModuleEntry;
            if (holder) {
                coverage[code] = holder.templateId;
            }
        });
        return coverage;
    } catch (err) {
        throw err;
    }
};

// Works out what assigning templateId as requested would do, WITHOUT
// changing anything. request = { module, stepSelection, stepCodes }.
// meta.plan = { module, stepCodes (fixed list; [] = whole-module entry),
// conflicts: [{ templateId, stepCode? }] } - the other templates that would
// lose the module/steps.
const planAssignment = (templateId, request, context) => {
    try {
        const { module } = request;
        const { assignments, isStepMode, stepOptions } = context;

        if (assignments === null) {
            return common.returnResult(false, 404, "Company settings are not set up yet, so this template can't be assigned to a module. Please save your company settings first.");
        }

        if (!isStepMode) {
            const holder = assignments.find((a) => a.module === module && !isStepEntry(a) && !isSameId(a.templateId, templateId));
            return common.returnResult(true, 200, 'Assignment planned', {
                plan: { module, stepCodes: [], conflicts: holder ? [{ templateId: holder.templateId }] : [] }
            });
        }

        const optionCodes = stepOptions.map((o) => o.code);
        const coverage = buildStepCoverage(assignments, templateId, stepOptions);
        const selection = request.stepSelection || STEP_SELECTIONS.ALL;

        let stepCodes;
        if (selection === STEP_SELECTIONS.ALL) {
            stepCodes = optionCodes;
        } else if (selection === STEP_SELECTIONS.REMAINING) {
            stepCodes = optionCodes.filter((code) => !coverage[code]);
            if (stepCodes.length === 0) {
                return common.returnResult(false, 400, 'Every order step is already assigned to another template, so there are no remaining steps. Please select the steps you want instead.');
            }
        } else {
            const requested = [...new Set((request.stepCodes || []).map((code) => String(code).trim().toUpperCase()))];
            if (requested.length === 0) {
                return common.returnResult(false, 400, 'Please select at least one order step.');
            }
            const unknown = requested.find((code) => !optionCodes.includes(code));
            if (unknown) {
                return common.returnResult(false, 400, `The order step "${unknown}" is not one of your order steps.`);
            }
            // Keep the workflow's order rather than the click order.
            stepCodes = optionCodes.filter((code) => requested.includes(code));
        }

        const conflicts = stepCodes.filter((code) => coverage[code]).map((code) => ({ stepCode: code, templateId: coverage[code] }));
        return common.returnResult(true, 200, 'Assignment planned', { plan: { module, stepCodes, conflicts } });
    } catch (err) {
        throw err;
    }
};

const toQuotedList = (items) => {
    try {
        const quoted = items.map((item) => `"${item}"`);
        return quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}` : quoted[0];
    } catch (err) {
        throw err;
    }
};

// The 409 message shown when the vendor hasn't confirmed taking the
// module/steps away from other templates (the frontend normally asks first;
// this is the server-side guard for a stale page).
const buildConflictMessage = async (vendorId, plan, stepOptions) => {
    try {
        const holderIds = [...new Set(plan.conflicts.map((c) => String(c.templateId)))];
        const holders = await EmailTemplateMaster.find({ _id: { $in: holderIds }, vendorId }, { templateName: 1 }).lean();
        const nameOf = (id) => (holders.find((h) => isSameId(h._id, id)) || {}).templateName || 'another template';

        if (plan.stepCodes.length === 0) {
            return `The ${getEmailModuleLabel(plan.module)} module is already assigned to the template "${nameOf(plan.conflicts[0].templateId)}". Please confirm that you want to replace it.`;
        }

        const stepName = (code) => (stepOptions.find((o) => o.code === code) || {}).name || code;
        const parts = holderIds.map((id) => {
            const steps = plan.conflicts.filter((c) => isSameId(c.templateId, id)).map((c) => stepName(c.stepCode));
            return `${toQuotedList(steps)} (assigned to "${nameOf(id)}")`;
        });
        return `Some of the selected order steps are already assigned to other templates: ${parts.join('; ')}. Please confirm that you want to move them to this template.`;
    } catch (err) {
        throw err;
    }
};

// planAssignment + the "confirm before taking it from another template" rule.
const checkAssignment = async (vendorId, templateId, request, confirmReassign, context) => {
    try {
        const planResult = planAssignment(templateId, request, context);
        if (!planResult.isSuccess) {
            return planResult;
        }
        const { plan } = planResult.meta;
        if (plan.conflicts.length > 0 && !confirmReassign) {
            return common.returnResult(false, 409, await buildConflictMessage(vendorId, plan, context.stepOptions));
        }
        return planResult;
    } catch (err) {
        throw err;
    }
};

// Applies a plan from checkAssignment. templateId ends up with exactly one
// entry (one module per template), and the module/steps are taken away from
// whichever templates held them - a step template left with no steps is
// unassigned.
const applyAssignment = async (vendorId, templateId, plan, userId) => {
    try {
        const { module, stepCodes } = plan;
        const others = ((await getTemplateAssignments(vendorId)) || []).filter((a) => !isSameId(a.templateId, templateId));
        let assignments;

        if (stepCodes.length > 0) {
            assignments = [];
            others.forEach((a) => {
                if (a.module === module && isStepEntry(a)) {
                    const remaining = a.stepCodes.filter((code) => !stepCodes.includes(code));
                    if (remaining.length > 0) {
                        assignments.push({ ...a, stepCodes: remaining });
                    }
                } else {
                    assignments.push(a);
                }
            });
            // Another template's whole-module entry is deliberately kept even
            // if step entries now cover every step: it simply sends nothing
            // while step-wise mode is on, and is the Order template again if
            // the feature is turned off.
            assignments.push({ module, templateId, stepCodes });
        } else {
            assignments = others.filter((a) => !(a.module === module && !isStepEntry(a)));
            assignments.push({ module, templateId, stepCodes: [] });
        }

        await saveTemplateAssignments(vendorId, assignments, userId);
        logger.logInfo(1, 0, 'Email template assigned to module', { vendorId, module, templateId, stepCodes });
    } catch (err) {
        throw err;
    }
};

const assignedTemplateLockedResult = (module, action) => common.returnResult(
    false, 409,
    `This template is assigned to the ${getEmailModuleLabel(module)} module. Please unassign the module before ${action}.`
);


/*
|--------------------------------------------------------------------------
| WHAT GOES OUT WITH A TEMPLATE: CC/BCC, ATTACHMENTS, IMAGES, INVOICE
|--------------------------------------------------------------------------
| Company Settings > Email is the one library of attachments and images; a
| template picks from it (attachmentIds / imageIds) and places images in its
| body with {{image:name}}. Each part only applies while its feature is on
| (WebsiteMaster AND CompanyMaster): isCcAndBccFeatureOn,
| isAddingOfAttachmentAllowed, isAddingOfImageAllowed, and for the invoice
| isInvoiceSendingFeatureInEmailOn + step-wise Order templates.
*/

const IMAGE_TOKEN = /\{\{\s*image:([a-z0-9_-]+)\s*\}\}/gi;

const isBothOn = (flag, websiteMasterData, companyMasterData) => {
    try {
        return websiteMasterData?.[flag] === true && companyMasterData?.[flag] === true;
    } catch (err) {
        throw err;
    }
};

// Whether an Order template may attach the order's invoice.
const isInvoiceOptionOn = (websiteMasterData, companyMasterData) => {
    try {
        return isBothOn('isInvoiceSendingFeatureInEmailOn', websiteMasterData, companyMasterData)
            && isStepWiseOrderTemplatesOn(websiteMasterData, companyMasterData);
    } catch (err) {
        throw err;
    }
};

// The {{image:name}} names a body uses.
const findImageNames = (html) => {
    try {
        const names = new Set();
        String(html || '').replace(IMAGE_TOKEN, (match, name) => { names.add(name.toLowerCase()); return match; });
        return [...names];
    } catch (err) {
        throw err;
    }
};

// What the template form offers: the Company Settings library and limits.
const getTemplateContentOptions = (companySettingsData, companyMasterData, websiteMasterData) => {
    try {
        return {
            isCcAndBccOn: isBothOn('isCcAndBccFeatureOn', websiteMasterData, companyMasterData),
            attachments: {
                isOn: isBothOn('isAddingOfAttachmentAllowed', websiteMasterData, companyMasterData),
                maxCount: companyMasterData?.numberOfAttachmentsAllowed ?? null,
                items: (companySettingsData?.emailAttachments || []).map((a) => ({
                    _id: a._id, displayName: a.displayName || a.originalName, originalName: a.originalName, size: a.size, mimeType: a.mimeType
                }))
            },
            images: {
                isOn: isBothOn('isAddingOfImageAllowed', websiteMasterData, companyMasterData),
                maxCount: companyMasterData?.numberOfImageAllowed ?? null,
                items: (companySettingsData?.emailImages || []).map((img) => ({ _id: img._id, name: img.name, url: img.url }))
            },
            isInvoiceOptionOn: isInvoiceOptionOn(websiteMasterData, companyMasterData),
            // Whether the body may carry links - the same two-level check
            // emailService.validateContentRules enforces on save.
            isEmbeddingLinksAllowed: isBothOn('isEmbeddingLinksAllowed', websiteMasterData, companyMasterData)
        };
    } catch (err) {
        throw err;
    }
};

// Checks and normalises the template's content choices before a save.
// `current` = the template being edited (null on create); `module` = the
// module it will have. Choices for a feature that's off are left as saved.
// Returns returnResult; meta.fields = what to set on the template.
const resolveTemplateContentFields = async (vendorId, data, current, module, companyMasterData, websiteMasterData) => {
    try {
        const fields = {};
        const has = (key) => data[key] !== undefined;

        if (isBothOn('isCcAndBccFeatureOn', websiteMasterData, companyMasterData)) {
            ['includeCompanyCcList', 'includeCompanyBccList', 'ccList', 'bccList'].forEach((key) => {
                if (has(key)) fields[key] = data[key];
            });
        }

        const attachmentsOn = isBothOn('isAddingOfAttachmentAllowed', websiteMasterData, companyMasterData);
        const imagesOn = isBothOn('isAddingOfImageAllowed', websiteMasterData, companyMasterData);
        const needsLibrary = (attachmentsOn && has('attachmentIds')) || imagesOn;
        const settings = needsLibrary
            ? await CompanySettings.findOne({ vendorId }, { emailAttachments: 1, emailImages: 1 }).lean()
            : null;

        // Invoice: Order templates only, and only while the option is on.
        let attachInvoice = has('attachInvoice') ? data.attachInvoice === true : (current ? current.attachInvoice === true : false);
        if (module !== EMAIL_MODULES.ORDER) attachInvoice = false;
        if (attachInvoice && !isInvoiceOptionOn(websiteMasterData, companyMasterData)) {
            if (has('attachInvoice')) {
                return common.returnResult(false, 403, 'Attaching the invoice is not available for your account.');
            }
            attachInvoice = current ? current.attachInvoice === true : false; // keep what was saved
        }
        if (has('attachInvoice') || module !== EMAIL_MODULES.ORDER) fields.attachInvoice = attachInvoice;

        if (attachmentsOn) {
            const attachmentIds = has('attachmentIds') ? [...new Set(data.attachmentIds.map(String))] : (current?.attachmentIds || []).map(String);
            const library = new Set((settings?.emailAttachments || []).map((a) => String(a._id)));
            if (has('attachmentIds') && attachmentIds.some((id) => !library.has(id))) {
                return common.returnResult(false, 400, 'One of the selected attachments no longer exists. Please refresh the page and try again.');
            }
            const maxCount = companyMasterData?.numberOfAttachmentsAllowed;
            const total = attachmentIds.length + (attachInvoice ? 1 : 0);
            if (maxCount != null && total > maxCount) {
                return common.returnResult(false, 400, `A template can send at most ${maxCount} attachment(s), including the invoice. You selected ${total}.`);
            }
            if (has('attachmentIds')) fields.attachmentIds = attachmentIds;
        }

        if (imagesOn) {
            const imageIds = has('imageIds') ? [...new Set(data.imageIds.map(String))] : (current?.imageIds || []).map(String);
            const libraryImages = settings?.emailImages || [];
            if (has('imageIds') && imageIds.some((id) => !libraryImages.some((img) => String(img._id) === id))) {
                return common.returnResult(false, 400, 'One of the selected images no longer exists. Please refresh the page and try again.');
            }
            const maxCount = companyMasterData?.numberOfImageAllowed;
            if (maxCount != null && imageIds.length > maxCount) {
                return common.returnResult(false, 400, `A template can use at most ${maxCount} image(s). You selected ${imageIds.length}.`);
            }
            // Every {{image:name}} in the body must be one of the selected images.
            const html = has('htmlBody') ? data.htmlBody : current?.htmlBody;
            const selectedNames = new Set(libraryImages.filter((img) => imageIds.includes(String(img._id))).map((img) => img.name));
            const missing = findImageNames(html).filter((name) => !selectedNames.has(name));
            if (missing.length > 0) {
                const one = missing.length === 1;
                return common.returnResult(false, 400, `The body uses ${missing.map((n) => `{{image:${n}}}`).join(', ')}, but ${one ? 'that image is' : 'those images are'} not selected for this template (or no longer ${one ? 'exists' : 'exist'} in Company Settings).`);
            }
            if (has('imageIds')) fields.imageIds = imageIds;
        }

        return common.returnResult(true, 200, 'Content choices are valid', { fields });
    } catch (err) {
        throw err;
    }
};

// Loads a stored file for an email, reusing bytes already read in this send.
const loadAssetBuffer = async (asset, cache) => {
    try {
        const key = String(asset._id);
        if (cache && cache.has(key)) return cache.get(key);
        const buffer = await readStoredAsset(asset);
        if (cache) cache.set(key, buffer);
        return buffer;
    } catch (err) {
        throw err;
    }
};

// Everything a template adds to an email besides its rendered text:
//   { includeCompanyCc, includeCompanyBcc, cc, bcc, attachments, images,
//     renderImages(html) -> html with {{image:name}} turned into inline images }
// Platform default templates (isDefault) get the Company Settings CC/BCC and
// nothing else. A file that can't be read is left out and logged - the email
// still goes. `cache` (a Map) lets a many-recipient send read each file once.
const buildTemplateEmailExtras = async ({ vendorId, template, isDefault, companyMasterData, websiteMasterData, companySettingsData, cache = null }) => {
    try {
        const extras = { includeCompanyCc: true, includeCompanyBcc: true, cc: [], bcc: [], attachments: [], images: [], renderImages: (html) => String(html || '').replace(IMAGE_TOKEN, '') };
        if (isDefault || !template) return extras;

        extras.includeCompanyCc = template.includeCompanyCcList !== false;
        extras.includeCompanyBcc = template.includeCompanyBccList !== false;
        if (isBothOn('isCcAndBccFeatureOn', websiteMasterData, companyMasterData)) {
            extras.cc = template.ccList || [];
            extras.bcc = template.bccList || [];
        }

        const selectedAttachmentIds = (template.attachmentIds || []).map(String);
        if (selectedAttachmentIds.length && isBothOn('isAddingOfAttachmentAllowed', websiteMasterData, companyMasterData)) {
            const entries = (companySettingsData?.emailAttachments || []).filter((a) => selectedAttachmentIds.includes(String(a._id)));
            const assets = await FileAsset.find({ _id: { $in: entries.map((a) => a.fileAssetId) }, vendorId, status: 'A' }).lean();
            for (const entry of entries) {
                const asset = assets.find((f) => String(f._id) === String(entry.fileAssetId));
                if (!asset) continue;
                try {
                    const content = await loadAssetBuffer(asset, cache);
                    const extension = asset.extension ? `.${asset.extension}` : '';
                    let filename = entry.displayName || entry.originalName || `attachment${extension}`;
                    if (extension && !filename.toLowerCase().endsWith(extension)) filename += extension;
                    extras.attachments.push({ filename, content, mimeType: asset.mimeType, size: content.length });
                } catch (readErr) {
                    logger.logWarning('Email attachment could not be read - sending without it', { vendorId, fileAssetId: asset._id, err: readErr });
                }
            }
        }

        const selectedImageIds = (template.imageIds || []).map(String);
        if (selectedImageIds.length && isBothOn('isAddingOfImageAllowed', websiteMasterData, companyMasterData)) {
            const usedNames = findImageNames(template.htmlBody);
            const entries = (companySettingsData?.emailImages || []).filter((img) => selectedImageIds.includes(String(img._id)) && usedNames.includes(img.name));
            const assets = await ImageAsset.find({ _id: { $in: entries.map((img) => img.imageAssetId) }, vendorId, status: 'A' }).lean();
            const cidByName = {};
            for (const entry of entries) {
                const asset = assets.find((a) => String(a._id) === String(entry.imageAssetId));
                if (!asset) continue;
                try {
                    const content = await loadAssetBuffer(asset, cache);
                    const cid = `${entry.name}@email-image`;
                    extras.images.push({ filename: entry.originalName || `${entry.name}.png`, content, mimeType: asset.mimeType, size: content.length, cid });
                    cidByName[entry.name] = cid;
                } catch (readErr) {
                    logger.logWarning('Email image could not be read - sending without it', { vendorId, imageAssetId: asset._id, err: readErr });
                }
            }
            extras.renderImages = (html) => String(html || '').replace(IMAGE_TOKEN, (match, name) => {
                const cid = cidByName[name.toLowerCase()];
                return cid ? `<img src="cid:${cid}" alt="${name}" style="max-width:100%;height:auto;" />` : '';
            });
        }

        return extras;
    } catch (err) {
        throw err;
    }
};

// Company Settings removed a library file - no template keeps pointing at it.
const removeLibraryFileFromTemplates = async (vendorId, { attachmentId = null, imageId = null }) => {
    try {
        if (attachmentId) await EmailTemplateMaster.updateMany({ vendorId }, { $pull: { attachmentIds: attachmentId } });
        if (imageId) await EmailTemplateMaster.updateMany({ vendorId }, { $pull: { imageIds: imageId } });
    } catch (err) {
        throw err;
    }
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
        const { templateName, module, subject, htmlBody, textBody, stepSelection, stepCodes, confirmReassign } = templateData;

        const choicesCheck = await resolveTemplateContentFields(vendorId, templateData, null, module || null, companyMasterData, websiteMasterData);
        if (!choicesCheck.isSuccess) {
            return choicesCheck;
        }
        const trimmedName = templateName.trim();

        const moduleCheck = checkModuleAllowed(module, websiteMasterData, companyMasterData);
        if (!moduleCheck.isSuccess) {
            return moduleCheck;
        }

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

        // A new template is always Active, so picking a module auto-assigns
        // it (to the selected order steps, in step-wise mode). Checked before
        // saving so a refused reassignment doesn't leave a half-done create
        // behind. No CompanySettings yet (404) doesn't block creating the
        // template - it's just saved unassigned.
        let plan = null;
        let context = null;
        if (module) {
            context = await loadAssignmentContext(vendorId, module, companyMasterData, websiteMasterData);
            const check = await checkAssignment(vendorId, null, { module, stepSelection, stepCodes }, confirmReassign, context);
            if (!check.isSuccess && check.statusCode !== 404) {
                return check;
            }
            plan = check.isSuccess ? check.meta.plan : null;
        }

        const template = new EmailTemplateMaster({
            vendorId,
            templateName: trimmedName,
            module: module || null,
            subject,
            htmlBody,
            textBody: textBody || null,
            ...choicesCheck.meta.fields,
            createdBy: userId
        });

        const saved = await template.save();

        if (plan) {
            await applyAssignment(vendorId, saved._id, plan, userId);
        }

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

        const { templateName, module, subject, htmlBody, textBody, status, stepSelection, stepCodes, confirmReassign } = updateData;

        const assignedModule = await getAssignedModuleOfTemplate(vendorId, templateId);
        const newModule = module !== undefined ? (module || null) : template.module;
        const isModuleChanged = module !== undefined && newModule !== template.module;
        if (isModuleChanged) {
            const moduleCheck = checkModuleAllowed(newModule, websiteMasterData, companyMasterData);
            if (!moduleCheck.isSuccess) {
                return moduleCheck;
            }
        }
        const willBeActive = (status !== undefined ? status : template.status) === 'A';

        if (status === 'I' && template.status !== 'I' && assignedModule) {
            return assignedTemplateLockedResult(assignedModule, 'marking it inactive');
        }

        // Changing the module - or, in step-wise mode, the order steps (the
        // frontend only sends stepSelection when the vendor touched them) -
        // behaves like creating the template with that module: an Active
        // template is auto-assigned (after the vendor confirms taking it from
        // other templates, if needed) and leaves its previous module. Editing
        // anything else never touches the assignment.
        let plan = null;
        let context = null;
        if (newModule && willBeActive && (isModuleChanged || stepSelection !== undefined)) {
            context = await loadAssignmentContext(vendorId, newModule, companyMasterData, websiteMasterData);
            if (isModuleChanged || context.isStepMode) {
                const check = await checkAssignment(vendorId, templateId, { module: newModule, stepSelection, stepCodes }, confirmReassign, context);
                if (!check.isSuccess && check.statusCode !== 404) {
                    return check;
                }
                plan = check.isSuccess ? check.meta.plan : null;
            }
        }

        const choicesCheck = await resolveTemplateContentFields(vendorId, updateData, template, newModule, companyMasterData, websiteMasterData);
        if (!choicesCheck.isSuccess) {
            return choicesCheck;
        }
        Object.assign(template, choicesCheck.meta.fields);

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
                template.inActiveMarkedBy = userId;
                template.inactiveMarkedDate = new Date();
            }
            template.status = status;
        }

        template.updatedBy = userId;

        const updated = await template.save();

        if (plan) {
            await applyAssignment(vendorId, templateId, plan, userId);
        } else if (isModuleChanged && assignedModule) {
            await removeTemplateAssignments(vendorId, templateId);
        }
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

        const assignedModule = await getAssignedModuleOfTemplate(vendorId, templateId);
        if (assignedModule) {
            return assignedTemplateLockedResult(assignedModule, 'deleting it');
        }

        template.status = 'D';
        template.deletedBy = userId;
        await template.save();

        logger.logInfo(1, 0, 'Email template deleted successfully', { vendorId, templateId });
        return common.returnResult(true, 200, 'Email template deleted successfully', {});
    } catch (err) {
        throw err;
    }
};

const fetchAllTemplatesAdmin = async (vendorId, companySettingsData, companyMasterData, websiteMasterData) => {
    try {
        const templates = await EmailTemplateMaster.find(
            { vendorId, status: { $in: ['A', 'I'] } },
            null,
            { sort: { templateName: 1 } }
        );

        // Which module (and order steps) each template is currently bound
        // to, the vendor's template quota, and - when step-wise order
        // templates are on - the order steps they can pick from, so the admin
        // page needs no extra round trips.
        const assignments = companySettingsData && Array.isArray(companySettingsData.emailTemplateAssignments)
            ? companySettingsData.emailTemplateAssignments.map((a) => ({
                module: a.module,
                templateId: a.templateId.toString(),
                stepCodes: Array.isArray(a.stepCodes) ? a.stepCodes : []
            }))
            : [];
        const numberOfTemplatesAllowed = companyMasterData && companyMasterData.numberOfTemplatesAllowed != null
            ? companyMasterData.numberOfTemplatesAllowed
            : null;

        const isStepWiseOn = isStepWiseOrderTemplatesOn(websiteMasterData, companyMasterData);
        const { options: orderStepOptions, hasWorkflow } = isStepWiseOn
            ? await getOrderStepOptions(companyMasterData)
            : { options: [], hasWorkflow: false };

        return common.returnResult(true, 200, 'Email templates fetched successfully', {
            templates,
            assignments,
            templateCount: templates.length,
            numberOfTemplatesAllowed,
            isStepWiseOrderTemplatesOn: isStepWiseOn,
            orderStepOptions,
            hasOrderWorkflow: hasWorkflow,
            // Modules whose feature (courier / discount / Free Cash) is off - hidden on the page.
            unavailableModules: getUnavailableModules(websiteMasterData, companyMasterData),
            // CC/BCC, the Company Settings attachment/image library and the invoice option.
            contentOptions: getTemplateContentOptions(companySettingsData, companyMasterData, websiteMasterData)
        });
    } catch (err) {
        throw err;
    }
};

// Single-template status flip used by the bulk action - same rules and audit
// fields as the `status` branch of updateTemplate, but with explicit
// "already active / already inactive" outcomes so a bulk run can report them.
const setTemplateStatus = async (vendorId, templateId, status, userId) => {
    try {
        const template = await EmailTemplateMaster.findOne({ _id: templateId, vendorId, status: { $ne: 'D' } });
        if (!template) {
            return common.returnResult(false, 404, 'Email template not found');
        }

        if (template.status === status) {
            return common.returnResult(false, 409, status === 'A' ? 'Email template is already active' : 'Email template is already inactive');
        }

        if (status === 'A') {
            template.activeMarkedBy = userId;
            template.activeMarkedDate = new Date();
        } else {
            const assignedModule = await getAssignedModuleOfTemplate(vendorId, templateId);
            if (assignedModule) {
                return assignedTemplateLockedResult(assignedModule, 'marking it inactive');
            }
            template.inActiveMarkedBy = userId;
            template.inactiveMarkedDate = new Date();
        }
        template.status = status;
        template.updatedBy = userId;
        await template.save();

        logger.logInfo(1, 0, 'Email template status changed', { vendorId, templateId, status });
        return common.returnResult(true, 200, 'Email template status updated successfully');
    } catch (err) {
        throw err;
    }
};

const bulkSetTemplateStatus = async (vendorId, userId, templateIds, status) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            templateIds,
            (id) => setTemplateStatus(vendorId, id, status, userId)
        );

        return common.returnResult(
            true, 200,
            `${status === 'A' ? 'Activated' : 'Deactivated'} ${successCount} of ${templateIds.length} email template(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

const bulkDeleteTemplates = async (vendorId, userId, templateIds) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            templateIds,
            (id) => softDeleteTemplate(vendorId, id, userId)
        );

        return common.returnResult(
            true, 200,
            `Deleted ${successCount} of ${templateIds.length} email template(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

// "Change Module" action: moves the template to `module` (its Module field
// AND its assignment - and, in step-wise mode, its order steps - together)
// so the two can never disagree. Only Active templates can be assigned.
// request = { module, stepSelection, stepCodes }.
const changeTemplateModule = async (vendorId, templateId, request, confirmReassign, userId, companyMasterData, websiteMasterData) => {
    try {
        const { module } = request;
        const template = await EmailTemplateMaster.findOne({ _id: templateId, vendorId, status: { $ne: 'D' } });
        if (!template) {
            return common.returnResult(false, 404, 'Email template not found');
        }
        if (template.status !== 'A') {
            return common.returnResult(false, 400, 'Only active templates can be assigned to a module. Please mark this template active first.');
        }
        const moduleCheck = checkModuleAllowed(module, websiteMasterData, companyMasterData);
        if (!moduleCheck.isSuccess) {
            return moduleCheck;
        }

        const context = await loadAssignmentContext(vendorId, module, companyMasterData, websiteMasterData);
        const planResult = planAssignment(templateId, request, context);
        if (!planResult.isSuccess) {
            return planResult;
        }
        const { plan } = planResult.meta;

        const current = context.assignments.find((a) => isSameId(a.templateId, templateId));
        const currentSteps = current && Array.isArray(current.stepCodes) ? current.stepCodes : [];
        const isUnchanged = !!current && current.module === module && template.module === module
            && currentSteps.length === plan.stepCodes.length && plan.stepCodes.every((code) => currentSteps.includes(code));
        if (isUnchanged) {
            return common.returnResult(false, 409, plan.stepCodes.length > 0
                ? `This template is already assigned to these steps of the ${getEmailModuleLabel(module)} module.`
                : `This template is already assigned to the ${getEmailModuleLabel(module)} module.`);
        }

        if (plan.conflicts.length > 0 && !confirmReassign) {
            return common.returnResult(false, 409, await buildConflictMessage(vendorId, plan, context.stepOptions));
        }

        template.module = module;
        template.updatedBy = userId;
        const updated = await template.save();

        await applyAssignment(vendorId, templateId, plan, userId);

        return common.returnResult(true, 200, `Email template assigned to the ${getEmailModuleLabel(module)} module successfully`, { template: updated });
    } catch (err) {
        throw err;
    }
};

// "Unassign Module" action: the template keeps its Module field (so the
// right variables still show while editing) but stops being sent for that
// module (and all its order steps). Required before the template can be
// deleted or marked inactive.
const unassignTemplateModule = async (vendorId, templateId) => {
    try {
        const template = await EmailTemplateMaster.findOne({ _id: templateId, vendorId, status: { $ne: 'D' } });
        if (!template) {
            return common.returnResult(false, 404, 'Email template not found');
        }

        const assignedModule = await getAssignedModuleOfTemplate(vendorId, templateId);
        if (!assignedModule) {
            return common.returnResult(false, 409, 'This template is not assigned to any module.');
        }

        await removeTemplateAssignments(vendorId, templateId);

        logger.logInfo(1, 0, 'Email template unassigned from module', { vendorId, templateId, module: assignedModule });
        return common.returnResult(true, 200, `Email template unassigned from the ${getEmailModuleLabel(assignedModule)} module successfully`);
    } catch (err) {
        throw err;
    }
};

const bulkUnassignTemplateModules = async (vendorId, templateIds) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            templateIds,
            (id) => unassignTemplateModule(vendorId, id)
        );

        return common.returnResult(
            true, 200,
            `Unassigned ${successCount} of ${templateIds.length} email template(s).`,
            { results, successCount, failureCount }
        );
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
    STEP_SELECTIONS,
    buildTemplateEmailExtras,
    removeLibraryFileFromTemplates,
    isInvoiceOptionOn,
    isCourierFeatureOn,
    isModuleAvailable,
    resolveTemplateForModule,
    getTemplateCount,
    addTemplate,
    updateTemplate,
    softDeleteTemplate,
    fetchAllTemplatesAdmin,
    setTemplateStatus,
    bulkSetTemplateStatus,
    bulkDeleteTemplates,
    changeTemplateModule,
    unassignTemplateModule,
    bulkUnassignTemplateModules,
    fetchTemplateById
};
