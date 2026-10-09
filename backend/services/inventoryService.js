const mongoose = require('mongoose');
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const User = require('../models/User');
const lowStockAlertService = require('./lowStockAlertService');
const common = require('../utils/common');
const logger = require('../utils/logger');
const {
    INVENTORY_LOG_TYPES,
    STOCK_OPERATIONS,
    STOCK_FILTERS,
    MAX_STOCK_PER_SIZE,
    INVENTORY_DEFAULT_PAGE_SIZE,
    INVENTORY_MAX_PAGE_SIZE
} = require('../constants/inventoryConstants');

/*
|--------------------------------------------------------------------------
| INVENTORY
|--------------------------------------------------------------------------
| Stock lives on each product SIZE (Product.variants[].sizes[].stock), so the
| Inventory list is one row per size: product > variant > size. Deleted
| products, variants and sizes are left out; inactive ones are listed.
|
| Stock is only ever changed with an atomic $inc guarded in the query filter
| (same approach as adjustSizeStock in cartService.js), so an adjustment made
| while an order is being placed can never lose an update or take stock
| below 0. Every adjustment writes an InventoryLog row.
*/

const LIVE_STATUSES = ['A', 'I'];

const SORT_OPTIONS = {
    NAME: { productName: 1, variantName: 1, sizeName: 1, sizeId: 1 },
    STOCK_LOW_TO_HIGH: { stock: 1, productName: 1, sizeId: 1 },
    STOCK_HIGH_TO_LOW: { stock: -1, productName: 1, sizeId: 1 }
};

const NAME_COLLATION = { locale: 'en', strength: 2 };

const toObjectId = (id) => {
    try {
        return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
    } catch (err) {
        throw err;
    }
};

const escapeRegex = (str) => {
    try {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch (err) {
        throw err;
    }
};

const getVariantName = (variant) => {
    try {
        return variant?.displayName || variant?.color || 'Default';
    } catch (err) {
        throw err;
    }
};

const normalizePaging = (query = {}) => {
    try {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(INVENTORY_MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || INVENTORY_DEFAULT_PAGE_SIZE));
        return { page, limit };
    } catch (err) {
        throw err;
    }
};

const buildPagination = (page, limit, total) => {
    try {
        return {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            hasMore: page * limit < total
        };
    } catch (err) {
        throw err;
    }
};

// $match on the unwound rows for one stock level. "Low" includes the
// threshold itself and never includes 0 (that is "out of stock").
const buildStockLevelMatch = (stockFilter, threshold) => {
    try {
        if (stockFilter === STOCK_FILTERS.OUT_OF_STOCK) return { stock: { $lte: 0 } };
        if (stockFilter === STOCK_FILTERS.LOW_STOCK) return { stock: { $gt: 0, $lte: threshold } };
        if (stockFilter === STOCK_FILTERS.IN_STOCK) return { stock: { $gt: threshold } };
        return null;
    } catch (err) {
        throw err;
    }
};

// query: { page, limit, search, stockFilter, sort }
// Returns the page of rows, the count of each stock level (for the whole
// search, not just this page) and the threshold the levels were worked out with.
const fetchInventory = async (vendorId, query, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const { page, limit } = normalizePaging(query);
        const lowStockSettings = lowStockAlertService.resolveLowStockSettings(websiteMasterData, companyMasterData, companySettingsData);
        const threshold = lowStockSettings.threshold;
        const sort = SORT_OPTIONS[query.sort] || SORT_OPTIONS.NAME;
        const search = typeof query.search === 'string' ? query.search.trim() : '';

        const pipeline = [{ $match: { vendorId: toObjectId(vendorId), status: { $in: LIVE_STATUSES } } }];

        // Narrows the products before they are unwound; the same search is
        // then applied per row below, so a SKU match lists only that size
        // while a product-name match lists all of the product's sizes.
        let rowSearchMatch = null;
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { name: pattern },
                        { productCode: pattern },
                        { 'variants.displayName': pattern },
                        { 'variants.color': pattern },
                        { 'variants.sizes.sizeName': pattern },
                        { 'variants.sizes.sku': pattern },
                        { 'variants.sizes.barcode': pattern }
                    ]
                }
            });
            rowSearchMatch = {
                $or: [
                    { productName: pattern },
                    { productCode: pattern },
                    { variantDisplayName: pattern },
                    { variantColor: pattern },
                    { sizeName: pattern },
                    { sku: pattern },
                    { barcode: pattern }
                ]
            };
        }

        pipeline.push(
            { $project: { name: 1, productCode: 1, status: 1, variants: 1 } },
            { $unwind: '$variants' },
            { $match: { 'variants.status': { $ne: 'D' } } },
            { $unwind: '$variants.sizes' },
            { $match: { 'variants.sizes.status': { $ne: 'D' } } },
            {
                $project: {
                    _id: 0,
                    productId: '$_id',
                    variantId: '$variants._id',
                    sizeId: '$variants.sizes._id',
                    productName: '$name',
                    productCode: '$productCode',
                    productStatus: '$status',
                    variantDisplayName: '$variants.displayName',
                    variantColor: '$variants.color',
                    // displayName, else color, else "Default" - a blank one is stored as '' on some products.
                    variantName: {
                        $cond: [
                            { $gt: [{ $strLenCP: { $ifNull: ['$variants.displayName', ''] } }, 0] },
                            '$variants.displayName',
                            { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$variants.color', ''] } }, 0] }, '$variants.color', 'Default'] }
                        ]
                    },
                    variantStatus: '$variants.status',
                    sizeName: '$variants.sizes.sizeName',
                    sizeStatus: '$variants.sizes.status',
                    sku: '$variants.sizes.sku',
                    barcode: '$variants.sizes.barcode',
                    imageUrl: '$variants.sizes.image.url',
                    stock: { $max: [0, { $ifNull: ['$variants.sizes.stock', 0] }] }
                }
            }
        );
        if (rowSearchMatch) pipeline.push({ $match: rowSearchMatch });

        const stockLevelMatch = buildStockLevelMatch(query.stockFilter, threshold);
        const pageStages = [
            ...(stockLevelMatch ? [{ $match: stockLevelMatch }] : []),
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { variantDisplayName: 0, variantColor: 0 } }
        ];

        pipeline.push({
            $facet: {
                rows: pageStages,
                counts: [
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
                            lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', threshold] }] }, 1, 0] } },
                            totalUnits: { $sum: '$stock' }
                        }
                    }
                ]
            }
        });

        const [result] = await Product.aggregate(pipeline).collation(NAME_COLLATION).allowDiskUse(true);
        const counts = result?.counts?.[0] || { total: 0, outOfStock: 0, lowStock: 0, totalUnits: 0 };
        const summary = {
            total: counts.total,
            inStock: counts.total - counts.outOfStock - counts.lowStock,
            lowStock: counts.lowStock,
            outOfStock: counts.outOfStock,
            totalUnits: counts.totalUnits
        };

        const filteredTotal = {
            [STOCK_FILTERS.IN_STOCK]: summary.inStock,
            [STOCK_FILTERS.LOW_STOCK]: summary.lowStock,
            [STOCK_FILTERS.OUT_OF_STOCK]: summary.outOfStock
        }[query.stockFilter] ?? summary.total;

        const rows = (result?.rows || []).map((row) => ({
            ...row,
            stockLevel: lowStockAlertService.getStockLevel(row.stock, threshold)
        }));

        return common.returnResult(true, 200, 'Inventory fetched successfully', {
            items: rows,
            pagination: buildPagination(page, limit, filteredTotal),
            summary,
            lowStock: {
                threshold,
                isAlertFeatureOn: lowStockSettings.isFeatureOn,
                isAlertOn: lowStockSettings.isAlertOn,
                isVendorThreshold: lowStockSettings.isVendorThreshold
            }
        });
    } catch (err) {
        throw err;
    }
};

// Works out why a guarded stock write matched nothing, so the vendor is told
// exactly what is wrong instead of a generic failure.
const explainFailedAdjustment = async (vendorId, item, operation, quantity) => {
    try {
        const product = await Product.findOne({ _id: item.productId, vendorId, status: { $in: LIVE_STATUSES } })
            .select('name variants._id variants.status variants.color variants.displayName variants.sizes._id variants.sizes.status variants.sizes.sizeName variants.sizes.stock')
            .lean();
        if (!product) {
            return common.returnResult(false, 404, 'Product not found. It may have been deleted.');
        }

        const variant = (product.variants || []).find((v) => v._id.toString() === item.variantId.toString() && v.status !== 'D');
        if (!variant) {
            return common.returnResult(false, 404, `Variant not found in "${product.name}". It may have been deleted.`);
        }

        const size = (variant.sizes || []).find((s) => s._id.toString() === item.sizeId.toString() && s.status !== 'D');
        if (!size) {
            return common.returnResult(false, 404, `Size not found in "${product.name}" - ${getVariantName(variant)}. It may have been deleted.`);
        }

        const label = `"${product.name}" - ${getVariantName(variant)} - ${size.sizeName}`;
        const currentStock = Math.max(0, Number(size.stock) || 0);

        if (operation === STOCK_OPERATIONS.DEDUCT && currentStock < quantity) {
            return common.returnResult(false, 409, `${label} has only ${currentStock} in stock, so ${quantity} cannot be deducted.`);
        }
        if (operation === STOCK_OPERATIONS.INCREASE && currentStock + quantity > MAX_STOCK_PER_SIZE) {
            return common.returnResult(false, 400, `${label} cannot hold more than ${MAX_STOCK_PER_SIZE} in stock.`);
        }
        return common.returnResult(false, 409, `The stock of ${label} just changed. Please try again.`);
    } catch (err) {
        throw err;
    }
};

// Adds to / takes off the stock of ONE size and writes its InventoryLog row.
// item: { productId, variantId, sizeId }. meta.stockChange is what
// lowStockAlertService needs to tell whether the size crossed the threshold.
const adjustStockOfSize = async (vendorId, userId, item, operation, quantity, remark = null, batchId = null) => {
    try {
        const isIncrease = operation === STOCK_OPERATIONS.INCREASE;
        const delta = isIncrease ? quantity : -quantity;

        // The guard sits in the query filter: a deduction needs that much
        // stock to be there, an increase must stay within the per-size cap.
        const sizeElemMatch = {
            _id: item.sizeId,
            status: { $ne: 'D' },
            stock: isIncrease ? { $lte: MAX_STOCK_PER_SIZE - quantity } : { $gte: quantity }
        };

        // No `new: true` - the document comes back as it was BEFORE the
        // update, which is where previousStock is read from.
        const productBefore = await Product.findOneAndUpdate(
            {
                _id: item.productId,
                vendorId,
                status: { $in: LIVE_STATUSES },
                variants: { $elemMatch: { _id: item.variantId, status: { $ne: 'D' }, sizes: { $elemMatch: sizeElemMatch } } }
            },
            { $inc: { 'variants.$[v].sizes.$[s].stock': delta } },
            {
                arrayFilters: [{ 'v._id': item.variantId }, { 's._id': item.sizeId }],
                projection: { name: 1, variants: 1 }
            }
        ).lean();

        if (!productBefore) {
            return await explainFailedAdjustment(vendorId, item, operation, quantity);
        }

        const variant = productBefore.variants.find((v) => v._id.toString() === item.variantId.toString());
        const size = variant.sizes.find((s) => s._id.toString() === item.sizeId.toString());
        const previousStock = Number(size.stock) || 0;
        const newStock = previousStock + delta;

        await InventoryLog.create({
            vendorId,
            productId: productBefore._id,
            variantId: variant._id,
            sizeId: size._id,
            productName: productBefore.name,
            variantName: getVariantName(variant),
            sizeName: size.sizeName || null,
            sku: size.sku || null,
            type: isIncrease ? INVENTORY_LOG_TYPES.INCREASE : INVENTORY_LOG_TYPES.DEDUCT,
            quantity,
            previousStock,
            newStock,
            remark: remark || null,
            batchId,
            createdBy: userId
        });

        return common.returnResult(true, 200, isIncrease ? 'Stock increased successfully' : 'Stock deducted successfully', {
            stockChange: {
                productId: productBefore._id,
                variantId: variant._id,
                sizeId: size._id,
                previousStock,
                newStock
            }
        });
    } catch (err) {
        throw err;
    }
};

// One size. data: { productId, variantId, sizeId, operation, quantity, remark }
const adjustStock = async (vendorId, userId, data, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const item = { productId: data.productId, variantId: data.variantId, sizeId: data.sizeId };
        const result = await adjustStockOfSize(vendorId, userId, item, data.operation, data.quantity, data.remark);
        if (!result.isSuccess) {
            return result;
        }

        if (data.operation === STOCK_OPERATIONS.DEDUCT) {
            lowStockAlertService.sendLowStockAlertInBackground({
                vendorId,
                stockChanges: [result.meta.stockChange],
                websiteMasterData,
                companyMasterData,
                companySettingsData,
                userId
            });
        }

        logger.logInfo(1, 0, 'Stock adjusted successfully', { vendorId, sizeId: item.sizeId, operation: data.operation, quantity: data.quantity });
        return result;
    } catch (err) {
        throw err;
    }
};

// Many sizes, the same quantity added to / taken off each (the checkbox
// selection). Best-effort: a size that can't be adjusted (e.g. not enough
// stock to deduct) is reported and the rest still go through. Every size
// that became low on stock in this run is listed in ONE alert email.
// data: { items: [{ productId, variantId, sizeId }], operation, quantity, remark }
const bulkAdjustStock = async (vendorId, userId, data, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const batchId = new mongoose.Types.ObjectId().toString();
        const stockChanges = [];

        const { results, successCount, failureCount } = await common.runBulkOperation(
            data.items,
            async (item) => {
                const result = await adjustStockOfSize(vendorId, userId, item, data.operation, data.quantity, data.remark, batchId);
                if (result.isSuccess) {
                    stockChanges.push(result.meta.stockChange);
                }
                return result;
            }
        );

        if (data.operation === STOCK_OPERATIONS.DEDUCT && stockChanges.length > 0) {
            lowStockAlertService.sendLowStockAlertInBackground({
                vendorId,
                stockChanges,
                websiteMasterData,
                companyMasterData,
                companySettingsData,
                userId
            });
        }

        logger.logInfo(successCount, failureCount, 'Bulk stock adjustment completed', { vendorId, operation: data.operation, quantity: data.quantity, successCount, failureCount });

        const verb = data.operation === STOCK_OPERATIONS.INCREASE ? 'increased' : 'deducted';
        return common.returnResult(
            true, 200,
            `Stock ${verb} for ${successCount} of ${data.items.length} item(s).`,
            {
                // runBulkOperation echoes the whole item back as `id` - the size is what identifies a row.
                results: results.map((entry) => ({ id: entry.id.sizeId, isSuccess: entry.isSuccess, message: entry.message })),
                successCount,
                failureCount
            }
        );
    } catch (err) {
        throw err;
    }
};

// query: { page, limit, sizeId, type, search }
const fetchInventoryLogs = async (vendorId, query) => {
    try {
        const { page, limit } = normalizePaging(query);

        const filter = { vendorId, status: 'A' };
        if (query.sizeId) filter.sizeId = query.sizeId;
        if (query.type) filter.type = query.type;

        const search = typeof query.search === 'string' ? query.search.trim() : '';
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            filter.$or = [
                { productName: pattern },
                { variantName: pattern },
                { sizeName: pattern },
                { sku: pattern },
                { remark: pattern }
            ];
        }

        const [total, logs] = await Promise.all([
            InventoryLog.countDocuments(filter),
            InventoryLog.find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        // Who made each change, resolved in one query.
        const userIds = [...new Set(logs.filter((log) => log.createdBy).map((log) => log.createdBy.toString()))];
        const users = userIds.length > 0
            ? await User.find({ _id: { $in: userIds }, vendorId }).select('name').lean()
            : [];
        const userNameById = new Map(users.map((user) => [user._id.toString(), user.name]));

        return common.returnResult(true, 200, 'Stock history fetched successfully', {
            logs: logs.map((log) => ({
                ...log,
                changedByName: log.createdBy ? (userNameById.get(log.createdBy.toString()) || null) : null
            })),
            pagination: buildPagination(page, limit, total)
        });
    } catch (err) {
        throw err;
    }
};

// The stock a product's sizes were created with (product add, bulk upload,
// clone) - one INITIAL row per size that starts with stock. A size created
// with 0 has nothing to record.
const recordInitialStock = async (product, userId) => {
    try {
        const rows = [];
        for (const variant of (product?.variants || [])) {
            if (variant.status === 'D') continue;
            for (const size of (variant.sizes || [])) {
                const stock = Number(size.stock) || 0;
                if (size.status === 'D' || stock <= 0) continue;
                rows.push({
                    vendorId: product.vendorId,
                    productId: product._id,
                    variantId: variant._id,
                    sizeId: size._id,
                    productName: product.name,
                    variantName: getVariantName(variant),
                    sizeName: size.sizeName || null,
                    sku: size.sku || null,
                    type: INVENTORY_LOG_TYPES.INITIAL,
                    quantity: stock,
                    previousStock: 0,
                    newStock: stock,
                    remark: 'Stock entered when the product was created',
                    createdBy: userId
                });
            }
        }

        if (rows.length > 0) {
            await InventoryLog.insertMany(rows);
        }
        return common.returnResult(true, 201, 'Initial stock recorded', { count: rows.length });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchInventory,
    adjustStock,
    bulkAdjustStock,
    fetchInventoryLogs,
    recordInitialStock
};
