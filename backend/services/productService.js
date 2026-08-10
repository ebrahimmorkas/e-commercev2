const Product = require('../models/Product');
const common = require('../utils/common');

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

const buildProductFilterQuery = (vendorId, filters = {}) => {
    const query = { vendorId };

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.mainCategory) {
        query.mainCategory = filters.mainCategory;
    }

    if (filters.subCategory) {
        query.subCategory = filters.subCategory;
    }

    if (filters.brand) {
        query.brand = filters.brand;
    }

    if (filters.search) {
        query.$or = [
            { name: { $regex: filters.search, $options: 'i' } },
            { searchKeywords: { $regex: filters.search, $options: 'i' } }
        ];
    }

    if (filters.minPrice || filters.maxPrice) {
        const priceCondition = {};
        if (filters.minPrice) priceCondition.$gte = Number(filters.minPrice);
        if (filters.maxPrice) priceCondition.$lte = Number(filters.maxPrice);
        query.variants = { $elemMatch: { price: priceCondition } };
    }

    return query;
};

const resolvePagination = (pagination = {}) => {
    const page = Number(pagination.page) > 0 ? Number(pagination.page) : 1;
    const limit = Number(pagination.limit) > 0 ? Number(pagination.limit) : 20;
    const skip = (page - 1) * limit;
    const sortField = pagination.sortBy || 'precedence';
    const sortOrder = pagination.sortOrder === 'asc' ? 1 : -1;

    return { page, limit, skip, sortField, sortOrder };
};

// ---------------------------------------------------------------------
// Vendor-admin functions
// ---------------------------------------------------------------------

const createProduct = async (productData) => {
    try {
        const existing = await Product.findOne({
            vendorId: productData.vendorId,
            $or: [
                { slug: productData.slug },
                { productCode: productData.productCode }
            ]
        });

        if (existing) {
            return common.returnResult(false, 409, 'A product with this slug or product code already exists.');
        }

        const product = new Product(productData);
        await product.save();

        return common.returnResult(true, 201, 'Product created successfully.', product);
    } catch (err) {
        throw err;
    }
};

const updateProduct = async (productId, vendorId, updateData, userId) => {
    try {
        const idCheck = common.validateObjectId(productId);
        if (!idCheck.valid) {
            return common.returnResult(false, 400, idCheck.message);
        }

        const product = await Product.findOne({ _id: productId, vendorId });
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        if (updateData.slug || updateData.productCode) {
            const duplicateFilters = [];
            if (updateData.slug) duplicateFilters.push({ slug: updateData.slug });
            if (updateData.productCode) duplicateFilters.push({ productCode: updateData.productCode });

            const duplicate = await Product.findOne({
                _id: { $ne: productId },
                vendorId,
                $or: duplicateFilters
            });

            if (duplicate) {
                return common.returnResult(false, 409, 'A product with this slug or product code already exists.');
            }
        }

        Object.assign(product, updateData);
        product.updatedBy = userId;

        await product.save();

        return common.returnResult(true, 200, 'Product updated successfully.', product);
    } catch (err) {
        throw err;
    }
};

const getProductById = async (productId, vendorId) => {
    try {
        const idCheck = common.validateObjectId(productId);
        if (!idCheck.valid) {
            return common.returnResult(false, 400, idCheck.message);
        }

        const product = await Product.findOne({ _id: productId, vendorId });
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        return common.returnResult(true, 200, 'Product fetched successfully.', product);
    } catch (err) {
        throw err;
    }
};

const listProducts = async (vendorId, filters = {}, pagination = {}) => {
    try {
        const { page, limit, skip, sortField, sortOrder } = resolvePagination(pagination);
        const query = buildProductFilterQuery(vendorId, filters);

        const [products, total] = await Promise.all([
            Product.find(query).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
            Product.countDocuments(query)
        ]);

        return common.returnResult(true, 200, 'Products fetched successfully.', {
            products,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        throw err;
    }
};

const deleteProduct = async (productId, vendorId, userId) => {
    try {
        const idCheck = common.validateObjectId(productId);
        if (!idCheck.valid) {
            return common.returnResult(false, 400, idCheck.message);
        }

        const product = await Product.findOne({ _id: productId, vendorId });
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        product.status = 'D';
        product.deletedBy = userId;
        product.updatedBy = userId;

        await product.save();

        return common.returnResult(true, 200, 'Product deleted successfully.', product);
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------
// Storefront (public / shopper-facing) functions
// ---------------------------------------------------------------------

const getProductBySlug = async (vendorId, slug) => {
    try {
        const product = await Product.findOne({ vendorId, slug, status: 'A' });
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        return common.returnResult(true, 200, 'Product fetched successfully.', product);
    } catch (err) {
        throw err;
    }
};

const listStorefrontProducts = async (vendorId, filters = {}, pagination = {}) => {
    try {
        const { page, limit, skip, sortField, sortOrder } = resolvePagination(pagination);
        const query = buildProductFilterQuery(vendorId, { ...filters, status: 'A' });

        const [products, total] = await Promise.all([
            Product.find(query).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
            Product.countDocuments(query)
        ]);

        return common.returnResult(true, 200, 'Products fetched successfully.', {
            products,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    createProduct,
    updateProduct,
    getProductById,
    listProducts,
    deleteProduct,
    getProductBySlug,
    listStorefrontProducts
};