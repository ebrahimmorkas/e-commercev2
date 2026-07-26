const Announcement = require('../models/Announcement');
const logger = require('../utils/logger');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');

const checkValidity = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
            if (!websiteMasterData?.isAnnouncementFeatureOn) {
                return common.returnResult(false, 403, websiteMasterData.temporaryFeatureOffMessage);
            }
            
            if (!companyMasterData?.isAnnouncementFeatureOn) {
                return common.returnResult(false, 403, websiteMasterData.featureDisabledForVendorMessage);
            }
        } catch (err) {
            throw err;        }
}

const invalidateAnnouncementCache = async (vendorId) => {
    try {
        await redisService.del(redisKeys.announcement(vendorId));
        logger.logInfo(1,0,'Announcement cache invalidated', { vendorId });
    } catch (err) {
        throw err;
    }
};

const getAnnouncementCount = async (vendorId) => {
    try {
        const count = await Announcement.countDocuments({ vendorId, status: { $ne: 'D' } });
        if(count == 0) {
            return common.returnResult(false, 200, `No Announcements to show`);
        }
        return common.returnResult(true, 200, 'Announcement count fetched successfully', { count });
    } catch (err) {
        throw err;
    }
};

const addAnnouncement = async (vendorId, announcementData, existingCount, userId) => {
    try {
        const isDefault = existingCount === 0;

        let { precedence } = announcementData;

        if (!precedence) {
            precedence = existingCount + 1;
        } else {
            const conflictExists = await Announcement.exists({
                vendorId,
                precedence,
                status: { $ne: 'D' }
            });

            if (conflictExists) {
                await Announcement.updateMany(
                    { vendorId, precedence: { $gte: precedence }, status: { $ne: 'D' } },
                    { $inc: { precedence: 1 } }
                );
            }
        }

        const announcement = new Announcement({
            vendorId,
            name: announcementData.name,
            heading: announcementData.heading || null,
            content: announcementData.content,
            startDate: announcementData.startDate,
            endDate: announcementData.endDate,
            isDefault,
            precedence,
            createdBy: userId
        });

        const saved = await announcement.save();

        logger.logInfo(1,0,'Announcement added successfully', { vendorId, announcementId: saved._id });

        await invalidateAnnouncementCache(vendorId);
        return common.returnResult(true, 201, 'Announcement added successfully', { announcement: saved });
    } catch (err) {
        throw err;
    }
};

const softDeleteAnnouncement = async (vendorId, announcementId, userId) => {
    try {
        const announcement = await Announcement.findOne({ _id: announcementId, vendorId, status: { $ne: 'D' } });
        if (!announcement) {
            return common.returnResult(false, 404, 'Announcement not found', {});
        }

        const wasDefault = announcement.isDefault;

        // Soft delete
        announcement.status = 'D';
        announcement.isDefault = false;
        announcement.deletedBy = userId;
        await announcement.save();

        // If deleted announcement was default, auto-assign lowest precedence remaining as new default
        if (wasDefault) {
            const nextDefault = await Announcement.findOne(
                { vendorId, status: { $ne: 'D' } },
                null,
                { sort: { precedence: 1 } }
            );
            if (nextDefault) {
                nextDefault.isDefault = true;
                await nextDefault.save();
                logger.logInfo(1,0,'New default announcement assigned', { vendorId, announcementId: nextDefault._id });
            }
        }

        // Re-order remaining announcements to fill precedence gaps cleanly
        const remaining = await Announcement.find(
            { vendorId, status: { $ne: 'D' } },
            null,
            { sort: { precedence: 1 } }
        );

        const bulkOps = remaining.map((ann, index) => ({
            updateOne: {
                filter: { _id: ann._id },
                update: { $set: { precedence: index + 1 } }
            }
        }));

        if (bulkOps.length > 0) {
            await Announcement.bulkWrite(bulkOps);
        }

        logger.logInfo(1,0,'Announcement soft deleted and precedences re-ordered', { vendorId, announcementId });
        await invalidateAnnouncementCache(vendorId);
        return common.returnResult(true, 200, 'Announcement deleted successfully', {});
    } catch (err) {
        throw err;
    }
};

const updateAnnouncement = async (vendorId, announcementId, updateData, userId) => {
    try {
        const announcement = await Announcement.findOne({ _id: announcementId, vendorId, status: { $ne: 'D' } });
        if (!announcement) {
            return common.returnResult(false, 404, 'Announcement not found', {});
        }

        const { name, heading, content, status, startDate, endDate, isDefault, precedence } = updateData;

        // Handle precedence update — Option A (fill old gap + make room at new position)
        if (precedence !== undefined && precedence !== announcement.precedence) {
            const oldPrecedence = announcement.precedence;
            const newPrecedence = precedence;

            await Announcement.updateMany(
                { vendorId, precedence: { $gt: oldPrecedence }, status: { $ne: 'D' }, _id: { $ne: announcementId } },
                { $inc: { precedence: -1 } }
            );

            await Announcement.updateMany(
                { vendorId, precedence: { $gte: newPrecedence }, status: { $ne: 'D' }, _id: { $ne: announcementId } },
                { $inc: { precedence: 1 } }
            );

            announcement.precedence = newPrecedence;
        }

        // Handle isDefault — unset current default first, then set new one
        if (isDefault === true && !announcement.isDefault) {
            await Announcement.updateOne(
                { vendorId, isDefault: true, status: { $ne: 'D' } },
                { $set: { isDefault: false } }
            );
            announcement.isDefault = true;
        }

        // Handle status transition (A/I) from the frontend radio button
        if (status !== undefined && status !== announcement.status) {
            if (status === 'A') {
                announcement.activeMarkedBy = userId;
                announcement.activeMarkedDate = new Date();
            } else if (status === 'I') {
                announcement.inActiveMarkedBy = userId;
                announcement.inactiveMarkedDate = new Date();
            }
            announcement.status = status;
        }

        if (name !== undefined) announcement.name = name;
        if (heading !== undefined) announcement.heading = heading;
        if (content !== undefined) announcement.content = content;
        if (startDate !== undefined) announcement.startDate = startDate;
        if (endDate !== undefined) announcement.endDate = endDate;

        announcement.updatedBy = userId;

        const updated = await announcement.save();
        logger.logInfo(1,0,'Announcement updated successfully', { vendorId, announcementId });
        await invalidateAnnouncementCache(vendorId);
        return common.returnResult(true, 200, 'Announcement updated successfully', { announcement: updated });
    } catch (err) {
        throw err;
    }
};

const fetchAllActiveAnnouncements = async (vendorId) => {
    try {
        const announcements = await Announcement.find(
            { vendorId, status: 'A', endDate: { $gte: new Date() } },
            null,
            { sort: { isDefault: -1, precedence: 1 } }
        );
        if (announcements.length == 0) {
            return common.returnResult(false, 200, `No Announcements to show`)
        }
        logger.logInfo(1,0,'Active announcements fetched from DB', { vendorId });
        return common.returnResult(true, 200, 'Announcements fetched successfully', { announcements });
    } catch (err) {
        throw err;
    }
};

const fetchAllAnnouncementsAdmin = async (vendorId) => {
    try {
        const announcements = await Announcement.find(
            { vendorId, status: { $in: ['A', 'I'] } },
            null,
            { sort: { isDefault: -1, precedence: 1 } }
        );
        if (announcements.length == 0) {
            return common.returnResult(false, 200, `No Announcements to show`)
        }
        logger.logInfo(1,0,'All announcements fetched from DB for admin', { vendorId });
        return common.returnResult(true, 200, 'Announcements fetched successfully', { announcements });
    } catch (err) {
        throw err;
    }
};

const fetchAnnouncementById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await announcementService.fetchAnnouncementById(vendorId, id);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.announcement);
    } catch (error) {
        logger.logException('announcementController: getAnnouncementById - Exception while fetching announcement by ID', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch announcement');
    }
};

module.exports = {
    addAnnouncement,
    getAnnouncementCount,
    softDeleteAnnouncement,
    updateAnnouncement,
    fetchAllActiveAnnouncements,
    fetchAllAnnouncementsAdmin,
    fetchAnnouncementById,
    checkValidity
};