const BrandMaster = require('../models/BrandMaster');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Resolves what should be DISPLAYED for a brand, honoring the vendor's
// CompanySettings.useShortNameForBrand toggle. Falls back to brandName
// whenever the short name is turned on but that particular brand has none
// set - a resolved display value is never null/empty as long as a brand
// doc was found.
const resolveBrandDisplayName = (brandDoc, useShortNameForBrand) => {
    if (!brandDoc) return null;
    if (useShortNameForBrand && brandDoc.brandShortName) {
        return brandDoc.brandShortName;
    }
    return brandDoc.brandName;
};

const getBrandCount = async (vendorId) => {
    try {
        const count = await BrandMaster.countDocuments({ vendorId, status: { $ne: 'D' } });
        return common.returnResult(true, 200, 'Brand count fetched successfully', { count });
    } catch (err) {
        throw err;
    }
};

const addBrand = async (vendorId, brandData, userId) => {
    try {
        const brandName = brandData.brandName.trim();
        const brandShortName = brandData.brandShortName ? brandData.brandShortName.trim() : null;

        const nameExists = await BrandMaster.exists({
            vendorId,
            brandName,
            status: { $ne: 'D' }
        });
        if (nameExists) {
            return common.returnResult(false, 409, `Brand "${brandName}" already exists.`);
        }

        if (brandShortName) {
            const shortNameExists = await BrandMaster.exists({
                vendorId,
                brandShortName,
                status: { $ne: 'D' }
            });
            if (shortNameExists) {
                return common.returnResult(false, 409, `Brand short name "${brandShortName}" already exists.`);
            }
        }

        const brand = new BrandMaster({
            vendorId,
            brandName,
            brandShortName,
            createdBy: userId
        });

        const saved = await brand.save();

        logger.logInfo(1, 0, 'Brand added successfully', { vendorId, brandId: saved._id });
        return common.returnResult(true, 201, 'Brand added successfully', { brand: saved });
    } catch (err) {
        throw err;
    }
};

const updateBrand = async (vendorId, brandId, updateData, userId) => {
    try {
        const brand = await BrandMaster.findOne({ _id: brandId, vendorId, status: { $ne: 'D' } });
        if (!brand) {
            return common.returnResult(false, 404, 'Brand not found');
        }

        const { brandName, brandShortName, status } = updateData;

        if (brandName !== undefined) {
            const trimmedName = brandName.trim();
            const nameExists = await BrandMaster.exists({
                vendorId,
                brandName: trimmedName,
                status: { $ne: 'D' },
                _id: { $ne: brandId }
            });
            if (nameExists) {
                return common.returnResult(false, 409, `Brand "${trimmedName}" already exists.`);
            }
            brand.brandName = trimmedName;
        }

        if (brandShortName !== undefined) {
            const trimmedShortName = brandShortName ? brandShortName.trim() : null;
            if (trimmedShortName) {
                const shortNameExists = await BrandMaster.exists({
                    vendorId,
                    brandShortName: trimmedShortName,
                    status: { $ne: 'D' },
                    _id: { $ne: brandId }
                });
                if (shortNameExists) {
                    return common.returnResult(false, 409, `Brand short name "${trimmedShortName}" already exists.`);
                }
            }
            brand.brandShortName = trimmedShortName;
        }

        if (status !== undefined && status !== brand.status) {
            if (status === 'A') {
                brand.activeMarkedBy = userId;
                brand.activeMarkedDate = new Date();
            } else if (status === 'I') {
                brand.inActiveMarkeddBy = userId;
                brand.inactiveMarkedDate = new Date();
            }
            brand.status = status;
        }

        brand.updatedBy = userId;

        const updated = await brand.save();
        logger.logInfo(1, 0, 'Brand updated successfully', { vendorId, brandId });
        return common.returnResult(true, 200, 'Brand updated successfully', { brand: updated });
    } catch (err) {
        throw err;
    }
};

const softDeleteBrand = async (vendorId, brandId, userId) => {
    try {
        const brand = await BrandMaster.findOne({ _id: brandId, vendorId, status: { $ne: 'D' } });
        if (!brand) {
            return common.returnResult(false, 404, 'Brand not found');
        }

        brand.status = 'D';
        brand.deletedBy = userId;
        await brand.save();

        logger.logInfo(1, 0, 'Brand soft deleted successfully', { vendorId, brandId });
        return common.returnResult(true, 200, 'Brand deleted successfully', {});
    } catch (err) {
        throw err;
    }
};

const fetchAllBrandsAdmin = async (vendorId) => {
    try {
        const brands = await BrandMaster.find(
            { vendorId, status: { $in: ['A', 'I'] } },
            null,
            { sort: { brandName: 1 } }
        );
        return common.returnResult(true, 200, 'Brands fetched successfully', { brands });
    } catch (err) {
        throw err;
    }
};

// Client-facing (role 'user'/guest) listing - ONLY status 'A' brands are
// ever shown here. Status 'I' (inactive) is admin-only visibility, and
// status 'D' (deleted) is never shown to anyone, on either endpoint.
const fetchAllBrandsClient = async (vendorId) => {
    try {
        // Projection - a customer only needs enough to display/select a
        // brand (id + name + short name). No audit/internal fields
        // (vendorId, status, createdBy, activeMarkedDate, etc.) are needed
        // on this public endpoint.
        const brands = await BrandMaster.find(
            { vendorId, status: 'A' },
            'brandName brandShortName',
            { sort: { brandName: 1 } }
        );
        return common.returnResult(true, 200, 'Brands fetched successfully', { brands });
    } catch (err) {
        throw err;
    }
};

const fetchBrandById = async (vendorId, brandId) => {
    try {
        const brand = await BrandMaster.findOne({ _id: brandId, vendorId, status: { $ne: 'D' } });
        if (!brand) {
            return common.returnResult(false, 404, 'Brand not found');
        }
        return common.returnResult(true, 200, 'Brand fetched successfully', { brand });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getBrandCount,
    addBrand,
    updateBrand,
    softDeleteBrand,
    fetchAllBrandsAdmin,
    fetchAllBrandsClient,
    fetchBrandById,
    resolveBrandDisplayName
};
