const Banner = require('../../models/Banner');
const common = require('../../utils/common');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const Joi = require('joi');

// Banner ids are common.encodeId-encoded (see formatBannerForResponse in
// bannerController), never a raw hex ObjectId - so this is a loose
// opaque-string check, not a hex/length one.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

// --- Bulk status / delete (multi-select checkbox actions) - the rest of
// this file is hand-written validation middleware (legacy), but new
// endpoints follow the project-wide Joi + validate.js convention.
const bulkBannerStatusSchema = Joi.object({
    bannerIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Banner IDs'),
    status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteBannerSchema = Joi.object({
    bannerIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Banner IDs')
});

// bannerMediaUpload (multer) already wrote any file(s) to a temp dir on disk by the
// time this middleware runs - if validation rejects the request, those temp files
// would otherwise never get cleaned up (bannerService only cleans up on the success
// path), so every rejection branch below must call this first.
const cleanupTempFiles = async (req) => {
    const paths = [req.files?.image?.[0]?.path, req.files?.video?.[0]?.path].filter(Boolean);
    await Promise.all(paths.map(async (p) => {
        try {
            await fs.unlink(p);
        } catch (err) {
            if (err.code !== 'ENOENT') logger.logException('bannerValidations: cleanupTempFiles - Exception while deleting temp file', err);
        }
    }));
};

// Checks the media file(s) on the request against the "exactly one" rule and the
// vendor's isVideoUploadingFeatureOn / mediaUploadAllowedInBanner entitlements.
// `required` = false lets update requests through when neither field is provided
// (an update that doesn't touch the media at all).
const validateBannerMedia = async (req, vendorId, { required }) => {
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    const websiteMasterData = req.websiteMasterData;
    const companyMasterData = req.companyMasterData;

    if (imageFile && videoFile) {
        return ['Only one of image or video may be uploaded, not both'];
    }

    if (!imageFile && !videoFile) {
        return required ? ['Either an image or a video is required'] : [];
    }

    const mediaUploadAllowedInBanner = companyMasterData?.mediaUploadAllowedInBanner || 'image';

    if (videoFile) {
        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isVideoUploadingFeatureOn', 'isVideoUploadingFeatureOn');
        if (!featureCheck.isSuccess) {
            return [featureCheck.message];
        }
        if (mediaUploadAllowedInBanner !== 'video' && mediaUploadAllowedInBanner !== 'both') {
            return ['Video uploads are not enabled for banners on this account'];
        }
    }

    if (imageFile) {
        if (mediaUploadAllowedInBanner !== 'image' && mediaUploadAllowedInBanner !== 'both') {
            return ['Image uploads are not enabled for banners on this account - please upload a video instead'];
        }
    }

    return [];
};

const validateAddBanner = async (req, res, next) => {
    try {
        const vendorId = req.vendorId;
        const { name, startDate, endDate, precedence } = req.body;
        const errors = [];

        errors.push(...await validateBannerMedia(req, vendorId, { required: true }));

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
                status: { $ne: 'D' }
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
            await cleanupTempFiles(req);
            return common.sendError(res, 400, 'Validation failed', errors);
        }

        next();
    } catch (err) {
        logger.logException('bannerValidations: validateAddBanner - Exception in validation middleware', { err });
    }
};

const validateDeleteBanner = (req, res, next) => {
    try {
        const { bannerId: encodedBannerId } = req.body;
        if (!encodedBannerId) {
            logger.logInfo(0,1,'bannerValidations: validateDeleteBanner - Banner ID not provided');
            return common.sendError(res, 400, 'Validation failed', ['Banner ID is required']);
        }
        // Decode here (not in the controller) since this middleware runs
        // first and needs the raw id for its own mongoose.Types.ObjectId
        // check below - req.body.bannerId is reassigned to the decoded
        // value so the controller uses it as-is, not double-decoded.
        let bannerId;
        try {
            bannerId = common.decodeId(encodedBannerId);
        } catch {
            logger.logInfo(0,1,`bannerValidations: validateDeleteBanner - Invalid banner ID ${encodedBannerId}`);
            return common.sendError(res, 400, 'Validation failed', ['Invalid banner ID']);
        }
        if (!mongoose.Types.ObjectId.isValid(bannerId)) {
            logger.logInfo(0,1,`bannerValidations: validateDeleteBanner - Invalid banner ID ${encodedBannerId}`);
            return common.sendError(res, 400, 'Validation failed', ['Invalid banner ID']);
        }
        req.body.bannerId = bannerId;
        next();
    } catch (err) {
        logger.logException('bannerValidations: validateDeleteBanner - Exception in validation middleware', { err });
    }
};

const validateUpdateBanner = async (req, res, next) => {
    try {
        const vendorId = req.vendorId;
        const { bannerId: encodedBannerId, name, status, startDate, endDate, isDefault, precedence } = req.body;
        const errors = [];

        // bannerId - decoded here (not in the controller) since this
        // middleware needs the raw id for its own Banner.findOne lookup
        // below; req.body.bannerId is reassigned so the controller uses it
        // as-is, not double-decoded.
        if (!encodedBannerId) {
            await cleanupTempFiles(req);
            return common.sendError(res, 400, 'Validation failed', ['Banner ID is required']);
        }
        let bannerId;
        try {
            bannerId = common.decodeId(encodedBannerId);
        } catch {
            await cleanupTempFiles(req);
            return common.sendError(res, 400, 'Validation failed', ['Invalid banner ID']);
        }
        if (!mongoose.Types.ObjectId.isValid(bannerId)) {
            await cleanupTempFiles(req);
            return common.sendError(res, 400, 'Validation failed', ['Invalid banner ID']);
        }
        req.body.bannerId = bannerId;

        const hasMediaFile = !!(req.files?.image?.[0] || req.files?.video?.[0]);

        // At least one field must be provided
        const bodyKeys = Object.keys(req.body).filter(k => k !== 'bannerId');
        if (bodyKeys.length === 0 && !hasMediaFile) {
            await cleanupTempFiles(req);
            return common.sendError(res, 400, 'Validation failed', ['At least one field must be provided for update']);
        }

        errors.push(...await validateBannerMedia(req, vendorId, { required: false }));

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
                    status: { $ne: 'D' },
                    _id: { $ne: bannerId }
                });
                if (nameExists) {
                    errors.push('Banner with this name already exists');
                }
            }
        }

        // status
        if (status !== undefined && !['A', 'I'].includes(status)) {
            errors.push('Status must be either A (active) or I (inactive)');
        }

        // isDefault
        if (isDefault !== undefined) {
            if (isDefault !== 'true' && isDefault !== true) {
                errors.push('isDefault cannot be set to false directly. Make another banner default instead');
            }
        }

        // Fetch existing doc for date cross-validation
        const existing = await Banner.findOne({ _id: bannerId, vendorId, status: { $ne: 'D' } });
        if (!existing) {
            await cleanupTempFiles(req);
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
            await cleanupTempFiles(req);
            return common.sendError(res, 400, 'Validation failed', errors);
        }

        next();
    } catch (err) {
        logger.logException('bannerValidations: validateUpdateBanner - Exception in validation middleware', { err });
    }
};

module.exports = {
    validateAddBanner,
    validateDeleteBanner,
    validateUpdateBanner,
    bulkBannerStatusSchema,
    bulkDeleteBannerSchema
};
