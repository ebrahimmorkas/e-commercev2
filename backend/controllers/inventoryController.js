const mongoose = require('mongoose');
const inventoryService = require('../services/inventoryService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// One Inventory row (a product size) with every ObjectId encoded via
// common.encodeId. The encoded sizeId is unique across the whole list, so it
// doubles as the row's key (`_id`) for the table and its checkboxes.
const formatInventoryItemForResponse = (item) => {
    try {
        if (!item) return item;
        const sizeId = common.encodeId(item.sizeId);
        return {
            ...item,
            _id: sizeId,
            productId: common.encodeId(item.productId),
            variantId: common.encodeId(item.variantId),
            sizeId
        };
    } catch (err) {
        throw err;
    }
};

const formatInventoryLogForResponse = (log) => {
    try {
        if (!log) return log;
        return {
            _id: common.encodeId(log._id),
            productId: common.encodeId(log.productId),
            variantId: common.encodeId(log.variantId),
            sizeId: common.encodeId(log.sizeId),
            productName: log.productName,
            variantName: log.variantName,
            sizeName: log.sizeName,
            sku: log.sku,
            type: log.type,
            quantity: log.quantity,
            previousStock: log.previousStock,
            newStock: log.newStock,
            remark: log.remark,
            isBulk: !!log.batchId,
            changedByName: log.changedByName,
            createdAt: log.createdAt
        };
    } catch (err) {
        throw err;
    }
};

// Decodes an encoded id sent by the client. A tampered / garbage value comes
// back as null (not a thrown error), so the caller can answer with a 400.
const decodeObjectId = (encodedId) => {
    try {
        const decoded = common.tryDecodeId(encodedId);
        return decoded && mongoose.Types.ObjectId.isValid(decoded) ? decoded : null;
    } catch (err) {
        throw err;
    }
};

// { productId, variantId, sizeId } encoded -> decoded, or null if any is invalid.
const decodeSizeReference = (reference) => {
    try {
        const productId = decodeObjectId(reference.productId);
        const variantId = decodeObjectId(reference.variantId);
        const sizeId = decodeObjectId(reference.sizeId);
        if (!productId || !variantId || !sizeId) return null;
        return { productId, variantId, sizeId };
    } catch (err) {
        throw err;
    }
};

const getInventory = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await inventoryService.fetchInventory(
            vendorId,
            req.query,
            req.websiteMasterData,
            req.companyMasterData,
            req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            items: result.meta.items.map(formatInventoryItemForResponse)
        });
    } catch (error) {
        logger.logException('inventoryController: getInventory - Exception while fetching inventory', { vendorId, error });
    }
};

const adjustStock = async (req, res) => {
    const vendorId = req.vendorId;
    let reference;
    try {
        reference = decodeSizeReference(req.body);
        if (!reference) {
            return common.sendError(res, 400, 'The selected product size is not valid. Please refresh the page and try again.');
        }

        const result = await inventoryService.adjustStock(
            vendorId,
            req.user._id,
            { ...req.body, ...reference },
            req.websiteMasterData,
            req.companyMasterData,
            req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            sizeId: common.encodeId(result.meta.stockChange.sizeId),
            previousStock: result.meta.stockChange.previousStock,
            newStock: result.meta.stockChange.newStock
        });
    } catch (error) {
        logger.logException('inventoryController: adjustStock - Exception while adjusting stock', { vendorId, reference, error });
    }
};

const bulkAdjustStock = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const items = req.body.items.map(decodeSizeReference);
        if (items.some((item) => !item)) {
            return common.sendError(res, 400, 'One or more selected product sizes are not valid. Please refresh the page and try again.');
        }

        const result = await inventoryService.bulkAdjustStock(
            vendorId,
            req.user._id,
            { ...req.body, items },
            req.websiteMasterData,
            req.companyMasterData,
            req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('inventoryController: bulkAdjustStock - Exception while bulk adjusting stock', { vendorId, error });
    }
};

const getInventoryLogs = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const query = { ...req.query };
        if (query.sizeId) {
            query.sizeId = decodeObjectId(query.sizeId);
            if (!query.sizeId) {
                return common.sendError(res, 400, 'The selected product size is not valid. Please refresh the page and try again.');
            }
        }

        const result = await inventoryService.fetchInventoryLogs(vendorId, query);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            logs: result.meta.logs.map(formatInventoryLogForResponse),
            pagination: result.meta.pagination
        });
    } catch (error) {
        logger.logException('inventoryController: getInventoryLogs - Exception while fetching stock history', { vendorId, error });
    }
};

module.exports = {
    getInventory,
    adjustStock,
    bulkAdjustStock,
    getInventoryLogs
};
