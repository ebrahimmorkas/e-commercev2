const announcementService = require('../services/announcementService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const redisKeys = require('../utils/redisKeys');
const redisService = require('../services/redisService');

const addAnnouncement = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        // Step 1: Check WebsiteMaster 
        const websiteMasterData = req.websiteMasterData;
        // console.log(`Here is your website msater data ${websiteMasterData.isAnnouncementFeatureOn}`)
        if (!websiteMasterData?.isAnnouncementFeatureOn) {
            return common.sendError(res, 403, 'This feature is temporarily off');
        }

        // Step 2: Check CompanyMaster (vendor-level toggle)
        const companyMasterData = req.companyMasterData;
        if (!companyMasterData?.isAnnouncementFeatureOn) {
            return common.sendError(res, 403, 'This feature is disabled in your plan');
        }

        // Step 3: Check announcement count against allowed limit
        const { numberOfAnnouncementsAllowed } = companyMasterData;
        const existingCount = await announcementService.getAnnouncementCount(vendorId);
        if (existingCount >= numberOfAnnouncementsAllowed) {
            return common.sendError(res, 403, 'You have exceeded the number of announcements allowed');
        }

        // Step 4: Add announcement
        const announcement = await announcementService.addAnnouncement(vendorId, req.body, existingCount);
        return common.sendSuccess(res, 201, 'Announcement added successfully', announcement);

    } catch (error) {
        logger.logException('announementController - exception in adding announcement', { vendorId, error });
        return common.sendError(res, 500, 'Failed to add announcement');
    }
};


const deleteAnnouncement = async (req, res) => {
    const vendorId = req.vendorId;
    const { announcement_id } = req.body;
    try {
        const result = await announcementService.softDeleteAnnouncement(vendorId, announcement_id, req.user._id);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('announcementController: deleteAnnouncment - exception in deleting announcement', { vendorId, error });
    }
};

const updateAnnouncement = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        const { announcement_id } = req.body;
        try {
            const updated = await announcementService.updateAnnouncement(vendorId, announcement_id, req.body);

            if (!updated) {
                return common.sendError(res, 404, 'Announcement not found');
            }

            return common.sendSuccess(res, 200, 'Announcement updated successfully', updated);
        } catch (error) {
            logger.logException('announcementController - exception in updating announcement', { vendorId, error });
            // return common.sendError(res, 500, 'Failed to update announcement');
        }
    } catch (err) {
        logger.logException(`announcementController: updateAnnouncement - Exception while updating the announcement from controller ${err}`)
    }
};

const getAllAnnouncements = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const companySettingsData = req.companySettingsData;
        if (!companySettingsData?.showAnnouncements) {
            return common.sendError(res, 403, 'Announcements are disabled for this store');
        }

        const result = await redisService.getOrSet(
            redisKeys.announcement(vendorId),
            async () => await announcementService.fetchAllActiveAnnouncements(vendorId),
            3600
        );

        return common.sendSuccess(res, result.statusCode, result.message, result.meta.announcements);
    } catch (error) {
        logger.logException('announcementController: getAllAnnouncements - Exception while fetching announcements', { vendorId, error });
    }
};

const getAllAnnouncementsAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await announcementService.fetchAllAnnouncementsAdmin(vendorId);
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.announcements);
    } catch (error) {
        logger.logException('announcementController: getAllAnnouncementsAdmin - Exception while fetching all announcements for admin', { vendorId, error });
    }
};

const getAnnouncementById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const announcement = await announcementService.fetchAnnouncementById(vendorId, id);

        if (!announcement) {
            return common.sendError(res, 404, 'Announcement not found');
        }

        return common.sendSuccess(res, 200, 'Announcement fetched successfully', announcement);
    } catch (error) {
        logger.logException('announcementController: getAnnouncementById - Exception while fetching announcement by ID', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch announcement');
    }
};

module.exports = {
    addAnnouncement,
    deleteAnnouncement,
    updateAnnouncement,
    getAllAnnouncements,
    getAllAnnouncementsAdmin,
    getAnnouncementById
};