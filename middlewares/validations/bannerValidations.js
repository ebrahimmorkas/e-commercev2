const Banner = require('../../models/Banner');
const common = require('../../utils/common');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');
const fs = require('fs');

// Helper to delete uploaded file if validation fails
const cleanupUploadedFile = (req) => {
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
};

const validateAddBanner = async (req, res, next) => {
    try {
        const vendorId = req.vendorId;
        const { name, startDate, endDate, precedence } = req.body;
        const errors = [];

        // image — multer puts file info on req.file
        if (!req.file) {
            errors.push('Image is required');
        }

        // name
        if (!name) {
            errors.push('Name is required');
        } else if (typeof name !== 'string') {
            errors.push('Name must be a string');
        } else if (name.trim().length < 2) {
            errors.push('Name must be at least 2 characters');
        } else if (name.trim().length > 20) {
            errors.push('Name must not exceed 20 characters');
        } else {
            const nameExists = await Banner.exists({
                vendorId,
                name: name.trim(),
                isDeleted: false
            });
            if (nameExists) {
                errors.push('Banner with this name already exists');
            }
        }

        // startDate
        if (!startDate) {
            errors.push('Start date is required');
        } else if (isNaN(Date.parse(startDate))) {
            errors.push('Start date must be a valid date');
        }

        // endDate
        if (!endDate) {
            errors.push('End date is required');
        } else if (isNaN(Date.parse(endDate))) {
            errors.push('End date must be a valid date');
        } else if (startDate && !isNaN(Date.parse(startDate)) && new Date(endDate) <= new Date(startDate)) {
            errors.push('End date must be greater than start date');
        }

        // precedence (optional)
        if (precedence !== undefined && precedence !== null) {
            const parsedPrecedence = parseInt(precedence);
            if (isNaN(parsedPrecedence)) {
                errors.push('Precedence must be a number');
            } else if (parsedPrecedence < 1) {
                errors.push('Precedence must be at least 1');
            }
        }

        if (errors.length > 0) {
            cleanupUploadedFile(req);
            return common.sendError(res, 400, 'Validation failed', errors);
        }

        next();
    } catch (err) {
        cleanupUploadedFile(req);
        logger.logException('bannerValidations: validateAddBanner - Exception in validation middleware', { err });
    }
};

const validateDeleteBanner = (req, res, next) => {
    try {
        const { banner_id } = req.body;
        if (!banner_id) {
            logger.logInfo('bannerValidations: validateDeleteBanner - Banner ID not provided');
            return common.sendError(res, 400, 'Validation failed', ['Banner ID is required']);
        }
        if (!mongoose.Types.ObjectId.isValid(banner_id)) {
            logger.logInfo(`bannerValidations: validateDeleteBanner - Invalid banner ID ${banner_id}`);
            return common.sendError(res, 400, 'Validation failed', ['Invalid banner ID']);
        }
        next();
    } catch (err) {
        logger.logException('bannerValidations: validateDeleteBanner - Exception in validation middleware', { err });
    }
};

const validateUpdateBanner = async (req, res, next) => {
    try {
        const vendorId = req.vendorId;
        const { banner_id, name, isActive, startDate, endDate, isDefault, precedence } = req.body;
        const errors = [];

        // banner_id
        if (!banner_id) {
            cleanupUploadedFile(req);
            return common.sendError(res, 400, 'Validation failed', ['Banner ID is required']);
        }
        if (!mongoose.Types.ObjectId.isValid(banner_id)) {
            cleanupUploadedFile(req);
            return common.sendError(res, 400, 'Validation failed', ['Invalid banner ID']);
        }

        // At least one field must be provided
        const bodyKeys = Object.keys(req.body).filter(k => k !== 'banner_id');
        if (bodyKeys.length === 0 && !req.file) {
            return common.sendError(res, 400, 'Validation failed', ['At least one field must be provided for update']);
        }

        // name
        if (name !== undefined) {
            if (typeof name !== 'string') {
                errors.push('Name must be a string');
            } else if (name.trim().length < 2) {
                errors.push('Name must be at least 2 characters');
            } else if (name.trim().length > 20) {
                errors.push('Name must not exceed 20 characters');
            } else {
                const nameExists = await Banner.exists({
                    vendorId,
                    name: name.trim(),
                    isDeleted: false,
                    _id: { $ne: banner_id }
                });
                if (nameExists) {
                    errors.push('Banner with this name already exists');
                }
            }
        }

        // isActive
        if (isActive !== undefined && isActive !== 'true' && isActive !== 'false' && typeof isActive !== 'boolean') {
            errors.push('isActive must be a boolean');
        }

        // isDefault
        if (isDefault !== undefined) {
            if (isDefault !== 'true' && isDefault !== true) {
                errors.push('isDefault cannot be set to false directly. Make another banner default instead');
            }
        }

        // Fetch existing doc for date cross-validation
        const existing = await Banner.findOne({ _id: banner_id, vendorId, isDeleted: false });
        if (!existing) {
            cleanupUploadedFile(req);
            return common.sendError(res, 404, 'Banner not found');
        }

        const resolvedStartDate = startDate ? new Date(startDate) : existing.startDate;
        const resolvedEndDate = endDate ? new Date(endDate) : existing.endDate;

        if (startDate !== undefined && isNaN(Date.parse(startDate))) {
            errors.push('Start date must be a valid date');
        }
        if (endDate !== undefined && isNaN(Date.parse(endDate))) {
            errors.push('End date must be a valid date');
        }
        if (!isNaN(Date.parse(resolvedStartDate)) && !isNaN(Date.parse(resolvedEndDate))) {
            if (resolvedEndDate <= resolvedStartDate) {
                errors.push('End date must be greater than start date');
            }
        }

        // precedence
        if (precedence !== undefined) {
            const parsedPrecedence = parseInt(precedence);
            if (isNaN(parsedPrecedence)) {
                errors.push('Precedence must be a number');
            } else if (parsedPrecedence < 1) {
                errors.push('Precedence must be at least 1');
            }
        }

        if (errors.length > 0) {
            cleanupUploadedFile(req);
            return common.sendError(res, 400, 'Validation failed', errors);
        }

        next();
    } catch (err) {
        cleanupUploadedFile(req);
        logger.logException('bannerValidations: validateUpdateBanner - Exception in validation middleware', { err });
    }
};

module.exports = {
    validateAddBanner,
    validateDeleteBanner,
    validateUpdateBanner
};