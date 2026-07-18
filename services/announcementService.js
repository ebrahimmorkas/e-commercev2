const Announcement = require('../models/Announcement');
const logger = require('../utils/logger');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');

const invalidateAnnouncementCache = async (vendorId) => {
    try {
        await redisService.del(redisKeys.announcement(vendorId));
        logger.logInfo('Announcement cache invalidated', { vendorId });
    } catch (err) {
        throw err;
    }
};

const getAnnouncementCount = async (vendorId) => {
    try {
        return await Announcement.countDocuments({ vendorId, isDeleted: false });
    } catch (err) {
        logger.logException(`announcementService: getAnnouncementCount - Exception while getting Announcement count`)
    }
};

const addAnnouncement = async (vendorId, announcementData, existingCount) => {
    try {
        // First announcement ever → isDefault true, else false
        const isDefault = existingCount === 0;

        // Precedence handling
        let { precedence } = announcementData;

        if (!precedence) {
            // Auto-assign as last
            precedence = existingCount + 1;
        } else {
            // Check if given precedence already exists for this vendor
            const conflictExists = await Announcement.exists({
                vendorId,
                precedence,
                isDeleted: false
            });

            if (conflictExists) {
                // Shift all announcements with precedence >= given precedence by 1
                await Announcement.updateMany(
                    { vendorId, precedence: { $gte: precedence }, isDeleted: false },
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
            precedence
        });

        const saved = await announcement.save();
        logger.logInfo('Announcement added successfully', { vendorId, announcementId: saved._id });

        await invalidateAnnouncementCache(vendorId);
        return saved;
    } catch (err) {
        throw err;
    }
};

const softDeleteAnnouncement = async (vendorId, announcementId) => {
    try {
        const announcement = await Announcement.findOne({ _id: announcementId, vendorId, isDeleted: false });
        if (!announcement) return { notFound: true };

        // Soft delete
        announcement.isDeleted = true;
        announcement.isDefault = false;
        await announcement.save();

        // If deleted announcement was default, auto-assign lowest precedence remaining as new default
        if (announcement.isDefault) {
            const nextDefault = await Announcement.findOne(
                { vendorId, isDeleted: false },
                null,
                { sort: { precedence: 1 } }
            );
            if (nextDefault) {
                nextDefault.isDefault = true;
                await nextDefault.save();
                logger.logInfo('New default announcement assigned', { vendorId, announcementId: nextDefault._id });
            }
        }

        // Re-order remaining announcements to fill precedence gaps cleanly
        const remaining = await Announcement.find(
            { vendorId, isDeleted: false },
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

        logger.logInfo('Announcement soft deleted and precedences re-ordered', { vendorId, announcementId });
        await invalidateAnnouncementCache(vendorId);
        return { deleted: true };
    } catch (err) {
        throw err;
    }
};

const updateAnnouncement = async (vendorId, announcementId, updateData) => {
    try {
        const announcement = await Announcement.findOne({ _id: announcementId, vendorId, isDeleted: false });
        if (!announcement) return null;

        const { name, heading, content, isActive, startDate, endDate, isDefault, precedence } = updateData;

        // Handle precedence update — Option A (fill old gap + make room at new position)
        if (precedence !== undefined && precedence !== announcement.precedence) {
            const oldPrecedence = announcement.precedence;
            const newPrecedence = precedence;

            // Step 1: Fill gap — shift down everything above old position
            await Announcement.updateMany(
                { vendorId, precedence: { $gt: oldPrecedence }, isDeleted: false, _id: { $ne: announcementId } },
                { $inc: { precedence: -1 } }
            );

            // Step 2: Make room — shift up everything at and above new position
            await Announcement.updateMany(
                { vendorId, precedence: { $gte: newPrecedence }, isDeleted: false, _id: { $ne: announcementId } },
                { $inc: { precedence: 1 } }
            );

            announcement.precedence = newPrecedence;
        }

        // Handle isDefault — unset current default first, then set new one
        if (isDefault === true && !announcement.isDefault) {
            await Announcement.updateOne(
                { vendorId, isDefault: true, isDeleted: false },
                { $set: { isDefault: false } }
            );
            announcement.isDefault = true;
        }

        // Update remaining allowed fields
        if (name !== undefined) announcement.name = name;
        if (heading !== undefined) announcement.heading = heading;
        if (content !== undefined) announcement.content = content;
        if (isActive !== undefined) announcement.isActive = isActive;
        if (startDate !== undefined) announcement.startDate = startDate;
        if (endDate !== undefined) announcement.endDate = endDate;

        const updated = await announcement.save();
        logger.logInfo('Announcement updated successfully', { vendorId, announcementId });
        await invalidateAnnouncementCache(vendorId);
        return updated;
    } catch (err) {
        throw err;
    }
};

const fetchAllActiveAnnouncements = async (vendorId) => {
    try {
        const announcements = await Announcement.find(
            { vendorId, isDeleted: false, isActive: true },
            null,
            { sort: { isDefault: -1, precedence: 1 } }
        );
        logger.logInfo('Active announcements fetched from DB', { vendorId });
        return announcements;
    } catch (err) {
        throw err;
    }
};

const fetchAllAnnouncementsAdmin = async (vendorId) => {
    try {
        const announcements = await Announcement.find(
            { vendorId, isDeleted: false },
            null,
            { sort: { isDefault: -1, precedence: 1 } }
        );
        logger.logInfo('All announcements fetched from DB for admin', { vendorId });
        return announcements;
    } catch (err) {
        throw err;
    }
};

const fetchAnnouncementById = async (vendorId, announcementId) => {
    try {
        const announcement = await Announcement.findOne({ _id: announcementId, vendorId, isDeleted: false });
        if (!announcement) return null;
        logger.logInfo('Announcement fetched by ID', { vendorId, announcementId });
        return announcement;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    addAnnouncement,
    getAnnouncementCount,
    softDeleteAnnouncement,
    updateAnnouncement,
    fetchAllActiveAnnouncements,
    fetchAllAnnouncementsAdmin,
    fetchAnnouncementById
};