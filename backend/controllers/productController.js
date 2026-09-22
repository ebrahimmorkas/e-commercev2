const productService = require('../services/productService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// --- ObjectId encode/decode helpers ------------------------------------------
// Product has the deepest id surface in the app (own id + FK refs at the
// product level, and again at the variant and size subdocument levels), so
// unlike every other controller in this rollout it needs recursive helpers
// instead of one flat formatter. Every id is guarded (falsy passes through
// unchanged) since most of these fields are optional/nullable.
const decodeIdOrNull = (id) => (id ? common.decodeId(id) : id);
const decodeIdArray = (ids) => (Array.isArray(ids) ? ids.map(decodeIdOrNull) : ids);
const encodeIdOrNull = (id) => (id ? common.encodeId(id) : id);
const encodeIdArray = (ids) => (Array.isArray(ids) ? ids.map(encodeIdOrNull) : ids);

// Decodes every id createProduct/updateProduct's payload can carry, incoming
// from the client. Safe on both create (no subdocument _id present) and
// update (existing _id present - see mergeVariantsIntoProduct in
// productService.js, which matches submitted variants/sizes back to existing
// ones by comparing decoded _id.toString() against what's already stored -
// skipping this decode would make every existing variant/size look brand new
// on every update).
const decodeProductPayloadIds = (body) => {
    if (!body) return body;

    const decoded = { ...body };
    if (decoded.productId !== undefined) decoded.productId = decodeIdOrNull(decoded.productId);
    if (decoded.mainCategory !== undefined) decoded.mainCategory = decodeIdOrNull(decoded.mainCategory);
    if (decoded.subCategory !== undefined) decoded.subCategory = decodeIdOrNull(decoded.subCategory);
    if (decoded.recommendedProducts !== undefined) decoded.recommendedProducts = decodeIdArray(decoded.recommendedProducts);
    if (decoded.taxIds !== undefined) decoded.taxIds = decodeIdArray(decoded.taxIds);

    if (Array.isArray(decoded.variants)) {
        decoded.variants = decoded.variants.map((variant) => {
            const decodedVariant = { ...variant };
            if (decodedVariant._id !== undefined) decodedVariant._id = decodeIdOrNull(decodedVariant._id);

            if (Array.isArray(decodedVariant.sizes)) {
                decodedVariant.sizes = decodedVariant.sizes.map((size) => {
                    const decodedSize = { ...size };
                    if (decodedSize._id !== undefined) decodedSize._id = decodeIdOrNull(decodedSize._id);
                    if (decodedSize.brandId !== undefined) decodedSize.brandId = decodeIdOrNull(decodedSize.brandId);
                    if (decodedSize.sizeId !== undefined) decodedSize.sizeId = decodeIdOrNull(decodedSize.sizeId);

                    if (decodedSize.image && decodedSize.image.imageAssetId !== undefined) {
                        decodedSize.image = { ...decodedSize.image, imageAssetId: decodeIdOrNull(decodedSize.image.imageAssetId) };
                    }
                    if (Array.isArray(decodedSize.additionalImages)) {
                        decodedSize.additionalImages = decodedSize.additionalImages.map((img) =>
                            (img && img.imageAssetId !== undefined) ? { ...img, imageAssetId: decodeIdOrNull(img.imageAssetId) } : img
                        );
                    }

                    if (decodedSize.excludeCountries !== undefined) decodedSize.excludeCountries = decodeIdArray(decodedSize.excludeCountries);
                    if (decodedSize.excludeStates !== undefined) decodedSize.excludeStates = decodeIdArray(decodedSize.excludeStates);
                    if (decodedSize.excludeCities !== undefined) decodedSize.excludeCities = decodeIdArray(decodedSize.excludeCities);

                    if (Array.isArray(decodedSize.values)) {
                        decodedSize.values = decodedSize.values.map((v) => ({
                            ...v,
                            measurementId: v.measurementId !== undefined ? decodeIdOrNull(v.measurementId) : v.measurementId,
                            unit: v.unit !== undefined ? decodeIdOrNull(v.unit) : v.unit
                        }));
                    }

                    if (decodedSize.weight && decodedSize.weight.unit !== undefined) {
                        decodedSize.weight = { ...decodedSize.weight, unit: decodeIdOrNull(decodedSize.weight.unit) };
                    }

                    return decodedSize;
                });
            }

            return decodedVariant;
        });
    }

    return decoded;
};

// Mirror of decodeProductPayloadIds, applied to an outgoing product - works
// on BOTH a raw mongoose doc (createProduct/updateProduct/toggleProductStatus/
// cloneProduct, which include audit fields) and an already-shaped plain
// object from productService's shapeProductForResponse (the admin/client GET
// endpoints, which already strip audit fields entirely) - fields simply
// absent on the shaped object are skipped by the falsy guards below.
const formatSizeForResponse = (size) => {
    if (!size) return size;
    return {
        ...size,
        _id: encodeIdOrNull(size._id),
        brandId: encodeIdOrNull(size.brandId),
        sizeId: encodeIdOrNull(size.sizeId),
        image: size.image ? { ...size.image, imageAssetId: encodeIdOrNull(size.image.imageAssetId) } : size.image,
        additionalImages: Array.isArray(size.additionalImages)
            ? size.additionalImages.map((img) => (img ? { ...img, _id: encodeIdOrNull(img._id), imageAssetId: encodeIdOrNull(img.imageAssetId) } : img))
            : size.additionalImages,
        excludeCountries: encodeIdArray(size.excludeCountries),
        excludeStates: encodeIdArray(size.excludeStates),
        excludeCities: encodeIdArray(size.excludeCities),
        values: Array.isArray(size.values)
            ? size.values.map((v) => ({ ...v, measurementId: encodeIdOrNull(v.measurementId), unit: encodeIdOrNull(v.unit) }))
            : size.values,
        weight: size.weight ? { ...size.weight, unit: encodeIdOrNull(size.weight.unit) } : size.weight,
        // warranty/return/exchange are single-nested subdocuments (Product.js's
        // policySchema is assigned via `type: policySchema`, which makes
        // Mongoose auto-generate an _id for the nested doc, unlike `image`
        // which is a plain nested path with no _id of its own) - encode those
        // auto ids too so no raw ObjectId leaks in the response.
        warranty: size.warranty ? { ...size.warranty, _id: encodeIdOrNull(size.warranty._id) } : size.warranty,
        return: size.return ? { ...size.return, _id: encodeIdOrNull(size.return._id) } : size.return,
        exchange: size.exchange ? { ...size.exchange, _id: encodeIdOrNull(size.exchange._id) } : size.exchange,
        createdBy: encodeIdOrNull(size.createdBy),
        updatedBy: encodeIdOrNull(size.updatedBy),
        deletedBy: encodeIdOrNull(size.deletedBy),
        activeMarkedBy: encodeIdOrNull(size.activeMarkedBy),
        inActiveMarkedBy: encodeIdOrNull(size.inActiveMarkedBy),
    };
};

const formatVariantForResponse = (variant) => {
    if (!variant) return variant;
    return {
        ...variant,
        _id: encodeIdOrNull(variant._id),
        createdBy: encodeIdOrNull(variant.createdBy),
        updatedBy: encodeIdOrNull(variant.updatedBy),
        deletedBy: encodeIdOrNull(variant.deletedBy),
        activeMarkedBy: encodeIdOrNull(variant.activeMarkedBy),
        inActiveMarkedBy: encodeIdOrNull(variant.inActiveMarkedBy),
        sizes: Array.isArray(variant.sizes) ? variant.sizes.map(formatSizeForResponse) : variant.sizes,
    };
};

const formatProductForResponse = (productDoc) => {
    if (!productDoc) return productDoc;
    const product = productDoc.toObject ? productDoc.toObject() : productDoc;

    return {
        ...product,
        _id: encodeIdOrNull(product._id),
        vendorId: encodeIdOrNull(product.vendorId),
        mainCategory: encodeIdOrNull(product.mainCategory),
        subCategory: encodeIdOrNull(product.subCategory),
        recommendedProducts: encodeIdArray(product.recommendedProducts),
        taxIds: encodeIdArray(product.taxIds),
        createdBy: encodeIdOrNull(product.createdBy),
        updatedBy: encodeIdOrNull(product.updatedBy),
        deletedBy: encodeIdOrNull(product.deletedBy),
        activeMarkedBy: encodeIdOrNull(product.activeMarkedBy),
        inActiveMarkedBy: encodeIdOrNull(product.inActiveMarkedBy),
        variants: Array.isArray(product.variants) ? product.variants.map(formatVariantForResponse) : product.variants,
    };
};

// Every catch block below ends here. It used to only log, which left the HTTP
// request open forever (the client just spun). Always answer, and turn a
// MongoDB duplicate-key error that slipped past a service pre-check (two
// admins saving the same name/SKU at once) into a clean 409.
const handleError = (res, message, error, context = {}) => {
    logger.logException(message, { ...context, error });
    if (res.headersSent) return;
    if (error && error.code === 11000) {
        return common.sendError(res, 409, 'Another product already uses one of these values (name, SKU, barcode or code). Please change it and try again.');
    }
    return common.sendError(res, 500, 'Something went wrong. Please try again.');
};

const createProduct = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user._id;
        const payload = decodeProductPayloadIds(req.body);

        const result = await productService.createProduct(
            vendorId,
            userId,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData,
            payload,
            req.files
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, product: formatProductForResponse(result.meta.product) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error creating product', error, { vendorId });
    }
};

const getAllProductsAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await productService.fetchAllProductsForAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, products: result.meta.products.map(formatProductForResponse) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error fetching products for admin', error, { vendorId });
    }
};

const getProductByIdAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = decodeIdOrNull(req.params.id);
        const result = await productService.fetchProductByIdForAdmin(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, product: formatProductForResponse(result.meta.product) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error fetching product by id for admin', error, { vendorId, id });
    }
};

// Cookies carry raw ObjectId strings for Country/State/City (set at login),
// and a plain zip_code string. Any/all may be absent - handled downstream
// as "location unknown" (generic excludeText, per spec).
const readLocationCookies = (req) => ({
    countryId: req.cookies?.Country || null,
    stateId: req.cookies?.State || null,
    cityId: req.cookies?.City || null,
    zipCode: req.cookies?.zip_code || null
});

const getAllProductsClient = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const locationCookies = readLocationCookies(req);
        const result = await productService.fetchAllProductsForClient(vendorId, req.companySettingsData, locationCookies);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, products: result.meta.products.map(formatProductForResponse) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error fetching products for client', error, { vendorId });
    }
};

const getProductByIdClient = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = decodeIdOrNull(req.params.id);
        const locationCookies = readLocationCookies(req);
        const result = await productService.fetchProductByIdForClient(vendorId, id, req.companySettingsData, locationCookies);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, product: formatProductForResponse(result.meta.product) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error fetching product by id for client', error, { vendorId, id });
    }
};

const getProductsByBrand = async (req, res) => {
    const vendorId = req.vendorId;
    let brandId;
    try {
        brandId = decodeIdOrNull(req.params.brandId);
        const locationCookies = readLocationCookies(req);
        const result = await productService.fetchProductsByBrandForClient(vendorId, brandId, req.companySettingsData, locationCookies);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, products: result.meta.products.map(formatProductForResponse) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error fetching products by brand', error, { vendorId, brandId });
    }
};

const getProductsByCategory = async (req, res) => {
    const vendorId = req.vendorId;
    let categoryId;
    try {
        categoryId = decodeIdOrNull(req.params.categoryId);
        const locationCookies = readLocationCookies(req);
        const result = await productService.fetchProductsByCategoryForClient(vendorId, categoryId, req.companySettingsData, locationCookies);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, products: result.meta.products.map(formatProductForResponse) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error fetching products by category', error, { vendorId, categoryId });
    }
};

const getProductsByCategoryAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    let categoryId;
    try {
        categoryId = decodeIdOrNull(req.params.categoryId);
        const result = await productService.fetchProductsByCategoryForAdmin(vendorId, categoryId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, products: result.meta.products.map(formatProductForResponse) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error fetching products by category for admin', error, { vendorId, categoryId });
    }
};

const bulkUploadProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const companySettingsData = req.companySettingsData;

        const bulkFeatureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBulkUploadForProductsFeatureOn', 'isBulkUploadForProductsFeatureOn');
        if (!bulkFeatureCheck.isSuccess) {
            return common.sendError(res, bulkFeatureCheck.statusCode, `Bulk upload is not enabled for your plan. Therefore you can't add the product through Excel file.`);
        }

        const excelFile = req.files?.excelFile?.[0];
        const mainImagesZipFile = req.files?.mainImagesZip?.[0];
        const additionalImagesZipFile = req.files?.additionalImagesZip?.[0];

        if (!excelFile) {
            return common.sendError(res, 400, 'Excel file (excelFile) is required');
        }

        const excelMaxSizeMB = websiteMasterData?.bulkUploadExcelMaxSizeMB;
        if (excelMaxSizeMB != null && excelFile.size > excelMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Excel file exceeds the allowed limit of ${excelMaxSizeMB}MB`);
        }

        const zipMaxSizeMB = websiteMasterData?.bulkUploadZipMaxSizeMB;
        if (mainImagesZipFile && zipMaxSizeMB != null && mainImagesZipFile.size > zipMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Main images zip exceeds the allowed limit of ${zipMaxSizeMB}MB`);
        }
        if (additionalImagesZipFile && zipMaxSizeMB != null && additionalImagesZipFile.size > zipMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Additional images zip exceeds the allowed limit of ${zipMaxSizeMB}MB`);
        }

        const userId = req.user._id;

        const result = await productService.bulkUploadProducts(
            vendorId, userId, excelFile.buffer,
            mainImagesZipFile ? mainImagesZipFile.buffer : null,
            additionalImagesZipFile ? additionalImagesZipFile.buffer : null,
            companyMasterData, websiteMasterData, companySettingsData
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error in bulk product upload', error, { vendorId });
    }
};

const bulkUpdateProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const companySettingsData = req.companySettingsData;

        const bulkFeatureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBulkUpdatingProductsAllowed', 'isBulkUpdatingProductsAllowed');
        if (!bulkFeatureCheck.isSuccess) {
            return common.sendError(res, bulkFeatureCheck.statusCode, `Bulk update is not enabled for your plan. Therefore you can't update products through Excel file.`);
        }

        const excelFile = req.files?.excelFile?.[0];
        const mainImagesZipFile = req.files?.mainImagesZip?.[0];
        const additionalImagesZipFile = req.files?.additionalImagesZip?.[0];

        if (!excelFile) {
            return common.sendError(res, 400, 'Excel file (excelFile) is required');
        }

        const excelMaxSizeMB = websiteMasterData?.bulkUploadExcelMaxSizeMB;
        if (excelMaxSizeMB != null && excelFile.size > excelMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Excel file exceeds the allowed limit of ${excelMaxSizeMB}MB`);
        }

        const zipMaxSizeMB = websiteMasterData?.bulkUploadZipMaxSizeMB;
        if (mainImagesZipFile && zipMaxSizeMB != null && mainImagesZipFile.size > zipMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Main images zip exceeds the allowed limit of ${zipMaxSizeMB}MB`);
        }
        if (additionalImagesZipFile && zipMaxSizeMB != null && additionalImagesZipFile.size > zipMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Additional images zip exceeds the allowed limit of ${zipMaxSizeMB}MB`);
        }

        const userId = req.user._id;

        const result = await productService.bulkUpdateProducts(
            vendorId, userId, excelFile.buffer,
            mainImagesZipFile ? mainImagesZipFile.buffer : null,
            additionalImagesZipFile ? additionalImagesZipFile.buffer : null,
            companyMasterData, websiteMasterData, companySettingsData
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error in bulk product update', error, { vendorId });
    }
};

const updateProduct = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user._id;
        const payload = decodeProductPayloadIds(req.body);

        const result = await productService.updateProduct(
            vendorId,
            userId,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData,
            payload,
            req.files
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, product: formatProductForResponse(result.meta.product) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error updating product', error, { vendorId });
    }
};

const toggleProductStatus = async (req, res) => {
    const vendorId = req.vendorId;
    let productId;
    try {
        const { status } = req.body;
        productId = decodeIdOrNull(req.body.productId);
        const userId = req.user._id;

        const result = await productService.toggleProductStatus(vendorId, userId, productId, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, product: formatProductForResponse(result.meta.product) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error toggling product status', error, { vendorId, productId });
    }
};

const deleteProduct = async (req, res) => {
    const vendorId = req.vendorId;
    let productId;
    try {
        productId = decodeIdOrNull(req.body.productId);
        const userId = req.user._id;

        const result = await productService.deleteProduct(vendorId, userId, productId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error deleting product', error, { vendorId, productId });
    }
};

const cloneProduct = async (req, res) => {
    const vendorId = req.vendorId;
    let productId;
    try {
        productId = decodeIdOrNull(req.body.productId);
        const userId = req.user._id;

        const result = await productService.cloneProduct(
            vendorId, userId, req.companyMasterData, req.websiteMasterData, req.companySettingsData, productId
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = { ...result.meta, product: formatProductForResponse(result.meta.product) };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error cloning product', error, { vendorId, productId });
    }
};

const bulkCloneProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const decodedIds = req.body.productIds.map(decodeIdOrNull);
        const userId = req.user._id;

        const result = await productService.bulkCloneProducts(
            vendorId, userId, req.companyMasterData, req.websiteMasterData, req.companySettingsData, decodedIds
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        // Each result carries the source productId (echoed back - re-encode
        // it) and, on success, a freshly created clonedProductId.
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({
                ...r,
                productId: encodeIdOrNull(r.productId),
                ...(r.clonedProductId ? { clonedProductId: encodeIdOrNull(r.clonedProductId) } : {})
            }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error bulk cloning products', error, { vendorId });
    }
};

const bulkSetProductStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { status } = req.body;
    try {
        const decodedIds = req.body.productIds.map(decodeIdOrNull);
        const userId = req.user._id;

        const result = await productService.bulkToggleProductStatus(vendorId, userId, decodedIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: encodeIdOrNull(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error bulk toggling product status', error, { vendorId });
    }
};

const bulkDeleteProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const decodedIds = req.body.productIds.map(decodeIdOrNull);
        const userId = req.user._id;

        const result = await productService.bulkDeleteProducts(vendorId, userId, decodedIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: encodeIdOrNull(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        return handleError(res, 'Error bulk deleting products', error, { vendorId });
    }
};

module.exports = {
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
    bulkSetProductStatus,
    bulkDeleteProducts,
    cloneProduct,
    bulkCloneProducts,
    getAllProductsAdmin,
    getProductByIdAdmin,
    getAllProductsClient,
    getProductByIdClient,
    getProductsByBrand,
    getProductsByCategory,
    getProductsByCategoryAdmin,
    bulkUploadProducts,
    bulkUpdateProducts
};