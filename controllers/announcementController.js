const announcementService = require('../services/announcementService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const redisKeys = require('../utils/redisKeys');
const redisService = require('../services/redisService');

const addAnnouncement = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const { numberOfAnnouncementsAllowed } = companyMasterData;
        const existingCount = await announcementService.getAnnouncementCount(vendorId);
        if (existingCount.meta.count >= numberOfAnnouncementsAllowed) {
            return common.sendError(res, 403, 'You have exceeded the number of announcements allowed');
        }

        // Step 4: Add announcement
        const result = await announcementService.addAnnouncement(vendorId, req.body, existingCount.meta.count);
        if(!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.announcement);

    } catch (error) {
        logger.logException('announementController - exception in adding announcement', { vendorId, error }); 
    }
};


const deleteAnnouncement = async (req, res) => {
    const vendorId = req.vendorId;
    const { announcement_id } = req.body;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
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
            const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
            const updated = await announcementService.updateAnnouncement(vendorId, announcement_id, req.body);

            if (!updated.isSuccess) {
                return common.sendError(res, updated.statusCode, updated.message, updated.meta.announcement);
            }

            return common.sendSuccess(res, 200, 'Announcement updated successfully', updated);
        } catch (error) {
            logger.logException('announcementController - exception in updating announcement', { vendorId, error });
        }
    } catch (err) {
        logger.logException(`announcementController: updateAnnouncement - Exception while updating the announcement from controller ${err}`)
    }
};

const getAllAnnouncements = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const companySettingsData = req.companySettingsData;
        if (!companySettingsData?.showAnnouncements) {
            return common.sendError(res, 403, websiteMasterData.featureDisabledMessageForClient);
        }

        const result = await redisService.getOrSet(
            redisKeys.announcement(vendorId),
            async () => await announcementService.fetchAllActiveAnnouncements(vendorId),
            3600
        );

        if(!result.statusCode) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta.announcements);
    } catch (error) {
        logger.logException('announcementController: getAllAnnouncements - Exception while fetching announcements', { vendorId, error });
    }
};

const getAllAnnouncementsAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const result = await announcementService.fetchAllAnnouncementsAdmin(vendorId);
        if(!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.announcements);
    } catch (error) {
        logger.logException('announcementController: getAllAnnouncementsAdmin - Exception while fetching all announcements for admin', { vendorId, error });
    }
};

const getAnnouncementById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
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