const sentEmailService = require('../services/sentEmailService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);

// SentEmail -> response: every id encoded.
const formatSentEmailForResponse = (sentEmail) => ({
    ...sentEmail,
    _id: encodeIfPresent(sentEmail._id),
    vendorId: encodeIfPresent(sentEmail.vendorId),
    createdBy: encodeIfPresent(sentEmail.createdBy),
    updatedBy: encodeIfPresent(sentEmail.updatedBy),
    recipients: (sentEmail.recipients || []).map((r) => ({ ...r, userId: encodeIfPresent(r.userId), emailLogId: encodeIfPresent(r.emailLogId) })),
    attachments: (sentEmail.attachments || []).map((a) => ({ ...a, fileAssetId: encodeIfPresent(a.fileAssetId), url: a.available === false ? null : a.url })),
    images: (sentEmail.images || []).map((img) => ({ ...img, imageAssetId: encodeIfPresent(img.imageAssetId), url: img.available === false ? null : img.url }))
});

// Ids sent back by the form arrive encoded.
const decodeIdList = (list) => (Array.isArray(list) ? list.map((id) => common.decodeId(id)) : []);

const getSendEmailOptions = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await sentEmailService.fetchSendEmailOptions(vendorId, req.companyMasterData, req.websiteMasterData, req.companySettingsData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = result.meta;
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...meta,
            libraryAttachments: meta.libraryAttachments.map((a) => ({ ...a, _id: common.encodeId(a._id) })),
            libraryImages: meta.libraryImages.map((img) => ({ ...img, _id: common.encodeId(img._id) })),
            groups: meta.groups.map((g) => ({ ...g, _id: common.encodeId(g._id) })),
            templates: meta.templates.map((t) => ({ ...t, _id: common.encodeId(t._id) }))
        });
    } catch (error) {
        logger.logException('sentEmailController: getSendEmailOptions - Exception while fetching Send Email options', { vendorId, error });
    }
};

const searchCustomers = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await sentEmailService.searchCustomers(vendorId, req.query.q, req.companyMasterData, req.websiteMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.customers.map((c) => ({ ...c, _id: common.encodeId(c._id) })));
    } catch (error) {
        logger.logException('sentEmailController: searchCustomers - Exception while searching customers', { vendorId, error });
    }
};

const sendEmail = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const payload = {
            ...req.body,
            customerIds: decodeIdList(req.body.customerIds),
            groupIds: decodeIdList(req.body.groupIds),
            attachmentIds: decodeIdList(req.body.attachmentIds),
            imageIds: decodeIdList(req.body.imageIds)
        };
        const result = await sentEmailService.sendComposedEmail(
            vendorId, req.user, payload, req.files || {}, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const { sentEmail } = result.meta;
        return common.sendSuccess(res, result.statusCode, result.message, {
            _id: common.encodeId(sentEmail._id),
            recipientCount: sentEmail.recipients.length
        });
    } catch (error) {
        logger.logException('sentEmailController: sendEmail - Exception while sending an email', { vendorId, error });
    }
};

const getHistory = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await sentEmailService.fetchHistory(vendorId, req.query, req.companyMasterData, req.websiteMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            items: result.meta.items.map((item) => ({ ...item, _id: common.encodeId(item._id) }))
        });
    } catch (error) {
        logger.logException('sentEmailController: getHistory - Exception while fetching sent emails', { vendorId, error });
    }
};

const getHistoryById = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await sentEmailService.fetchHistoryById(vendorId, id, req.companyMasterData, req.websiteMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatSentEmailForResponse(result.meta.sentEmail));
    } catch (error) {
        logger.logException('sentEmailController: getHistoryById - Exception while fetching a sent email', { vendorId, id, error });
    }
};

module.exports = {
    getSendEmailOptions,
    searchCustomers,
    sendEmail,
    getHistory,
    getHistoryById
};
