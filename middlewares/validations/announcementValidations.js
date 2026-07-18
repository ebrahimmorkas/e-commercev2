const Announcement = require('../../models/Announcement');
const common = require('../../utils/common');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');

const validateAddAnnouncement = async (req, res, next) => {
    try {
        const vendorId = req.vendorId;
        const { name, heading, content, startDate, endDate, precedence } = req.body;
        const errors = [];

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
            // Uniqueness check — only among non-deleted announcements for this vendor
            const nameExists = await Announcement.exists({
                vendorId,
                name: name.trim(),
                isDeleted: false
            });
            if (nameExists) {
                errors.push('Announcement with this name already exists');
            }
        }

        // heading (optional)
        if (heading !== undefined && heading !== null) {
            if (typeof heading !== 'string') {
                errors.push('Heading must be a string');
            } else if (heading.trim().length < 2) {
                errors.push('Heading must be at least 2 characters');
            } else if (heading.trim().length > 20) {
                errors.push('Heading must not exceed 20 characters');
            }
        }

        // content
        if (!content) {
            errors.push('Content is required');
        } else if (typeof content !== 'string') {
            errors.push('Content must be a string');
        } else if (content.trim().length < 2) {
            errors.push('Content must be at least 2 characters');
        } else if (content.trim().length > 200) {
            errors.push('Content must not exceed 200 characters');
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
            if (typeof precedence !== 'number') {
                errors.push('Precedence must be a number');
            } else if (!Number.isInteger(precedence)) {
                errors.push('Precedence must be an integer');
            } else if (precedence < 1) {
                errors.push('Precedence must be at least 1');
            }
        }

        if (errors.length > 0) {
            return common.sendError(res, 400, 'Validation failed', errors);
        }

        next();

    } catch (err) {
        logger.logException(`announcementValidations middleware - exception thrown`, {err});
        // return common.sendError(res, 500, 'Validation error');
    }
};

const validateDeleteAnnouncement = (req, res, next) => {
    try {
        console.log(req.body);
    const { announcement_id } = req.body;
    if (!announcement_id) {
        logger.logInfo(`announcementValidation: validateDeleteAnnouncement - announcement ID no provided`);
        return common.sendError(res, 400, 'Validation failed', ['Announcement ID is required']);
    }
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(announcement_id)) {
        logger.logInfo(`announcementValidation: validateDeleteAnnouncement - Invalid announcement ID ${announcement_id}`);
        return common.sendError(res, 400, 'Validation failed', ['Invalid announcement ID']);
    }
    next();
} catch (err) {
    logger.logException(`announcementValidation: validateDeleteAnnouncement - Exception in validatiob middleware while deleting announcement ${err}`);
}
};

const validateUpdateAnnouncement = async (req, res, next) => {
    try {
        const vendorId = req.vendorId;
        const { announcement_id } = req.body;
        const { name, heading, content, isActive, startDate, endDate, isDefault, precedence } = req.body;
        const errors = [];

        // id from req.body
        if (!announcement_id) {
            return common.sendError(res, 400, 'Validation failed', ['Announcement ID is required']);
        }
        if (!mongoose.Types.ObjectId.isValid(announcement_id)) {
            return common.sendError(res, 400, 'Validation failed', ['Invalid announcement ID']);
        }

        // At least one field must be provided
        if (Object.keys(req.body).length === 0) {
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
                // Uniqueness check — exclude current document
                const nameExists = await Announcement.exists({
                    vendorId,
                    name: name.trim(),
                    isDeleted: false,
                    _id: { $ne: announcement_id }
                });
                if (nameExists) {
                    errors.push('Announcement with this name already exists');
                }
            }
        }

        // heading
        if (heading !== undefined && heading !== null) {
            if (typeof heading !== 'string') {
                errors.push('Heading must be a string');
            } else if (heading.trim().length < 2) {
                errors.push('Heading must be at least 2 characters');
            } else if (heading.trim().length > 20) {
                errors.push('Heading must not exceed 20 characters');
            }
        }

        // content
        if (content !== undefined) {
            if (typeof content !== 'string') {
                errors.push('Content must be a string');
            } else if (content.trim().length < 2) {
                errors.push('Content must be at least 2 characters');
            } else if (content.trim().length > 200) {
                errors.push('Content must not exceed 200 characters');
            }
        }

        // isActive
        if (isActive !== undefined && typeof isActive !== 'boolean') {
            errors.push('isActive must be a boolean');
        }

        // isDefault — can only be set to true, never false directly
        if (isDefault !== undefined) {
            if (typeof isDefault !== 'boolean') {
                errors.push('isDefault must be a boolean');
            } else if (isDefault === false) {
                errors.push('isDefault cannot be set to false directly. Make another announcement default instead');
            }
        }

        // Fetch existing doc for date cross-validation
        const existing = await Announcement.findOne({ _id: announcement_id, vendorId, isDeleted: false });
        if (!existing) {
            return common.sendError(res, 404, 'Announcement not found');
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
            if (typeof precedence !== 'number') {
                errors.push('Precedence must be a number');
            } else if (!Number.isInteger(precedence)) {
                errors.push('Precedence must be an integer');
            } else if (precedence < 1) {
                errors.push('Precedence must be at least 1');
            }
        }

        if (errors.length > 0) {
            return common.sendError(res, 400, 'Validation failed', errors);
        }

        next();
    } catch (err) {
        logger.logException(`announcementValidations: updateAnnouncement - Exception while updating the announcement. Exception is ${err}`, {err})
    }
};


module.exports = {
    validateAddAnnouncement,
    validateDeleteAnnouncement,
    validateUpdateAnnouncement
};