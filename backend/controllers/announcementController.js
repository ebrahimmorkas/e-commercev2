const announcementService = require('../services/announcementService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const redisKeys = require('../utils/redisKeys');
const redisService = require('../services/redisService');

// Converts an Announcement mongoose doc into a response-safe object with
// every ObjectId field encoded via common.encodeId.
const formatAnnouncementForResponse = (announcementDoc) => {
    if (!announcementDoc) return announcementDoc;
    const announcement = announcementDoc.toObject ? announcementDoc.toObject() : announcementDoc;

    return {
        ...announcement,
        _id: announcement._id ? common.encodeId(announcement._id) : announcement._id,
        vendorId: announcement.vendorId ? common.encodeId(announcement.vendorId) : announcement.vendorId,
        createdBy: announcement.createdBy ? common.encodeId(announcement.createdBy) : announcement.createdBy,
        updatedBy: announcement.updatedBy ? common.encodeId(announcement.updatedBy) : announcement.updatedBy,
        deletedBy: announcement.deletedBy ? common.encodeId(announcement.deletedBy) : announcement.deletedBy,
        activeMarkedBy: announcement.activeMarkedBy ? common.encodeId(announcement.activeMarkedBy) : announcement.activeMarkedBy,
        inActiveMarkedBy: announcement.inActiveMarkedBy ? common.encodeId(announcement.inActiveMarkedBy) : announcement.inActiveMarkedBy,
    };
};

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
        return common.sendSuccess(res, result.statusCode, result.message, formatAnnouncementForResponse(result.meta.announcement));

    } catch (error) {
        logger.logException('announementController - exception in adding announcement', { vendorId, error }); 
    }
};


const deleteAnnouncement = async (req, res) => {
    const vendorId = req.vendorId;
    let announcement_id;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        announcement_id = common.decodeId(req.body.announcement_id);
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
        // announcement_id arrives here already decoded - validateUpdateAnnouncement
        // (announcementValidations.js) has to run its own DB lookups keyed on
        // this id before the controller ever sees it, so it decodes and
        // reassigns req.body.announcement_id itself. Decoding again here
        // would throw (common.decodeId isn't idempotent on an already-raw id).
        const { announcement_id } = req.body;
        try {
            const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
            const updated = await announcementService.updateAnnouncement(vendorId, announcement_id, req.body);

            if (updated.meta?.announcement) {
                updated.meta.announcement = formatAnnouncementForResponse(updated.meta.announcement);
            }

            if (!updated.isSuccess) {
                return common.sendError(res, updated.statusCode, updated.message, updated.meta.announcement);
            }

            // Pre-existing behavior kept as-is (passes the whole service result
            // wrapper as response data, not just updated.meta.announcement) -
            // out of scope for the id-encoding pass to restructure.
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

        // Vendor's own show/hide toggle (CompanySettings.showAnnouncements) -
        // distinct from the isAnnouncementFeatureOn entitlement checked above.
        // Not an error condition, just "nothing to show" - same convention as
        // showBanners/showReviewsToCustomers (see CompanySettings.js).
        const companySettingsData = req.companySettingsData;
        if (companySettingsData && companySettingsData.showAnnouncements === false) {
            return common.sendSuccess(res, 200, 'Announcements are disabled for this store', []);
        }

        const result = await redisService.getOrSet(
            redisKeys.announcement(vendorId),
            async () => await announcementService.fetchAllActiveAnnouncements(vendorId),
            3600
        );

        if(!result.statusCode) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, (result.meta.announcements || []).map(formatAnnouncementForResponse));
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
        return common.sendSuccess(res, result.statusCode, result.message, (result.meta.announcements || []).map(formatAnnouncementForResponse));
    } catch (error) {
        logger.logException('announcementController: getAllAnnouncementsAdmin - Exception while fetching all announcements for admin', { vendorId, error });
    }
};

const getAnnouncementById = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isAnnouncementFeatureOn", "isAnnouncementFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        id = common.decodeId(req.params.id);
        const result = await announcementService.fetchAnnouncementById(vendorId, id);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, 200, 'Announcement fetched successfully', formatAnnouncementForResponse(result.meta.announcement));
    } catch (error) {
        logger.logException('announcementController: getAnnouncementById - Exception while fetching announcement by ID', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch announcement');
    }
};

const bulkSetAnnouncementStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { status } = req.body;
    try {
        const decodedIds = req.body.announcementIds.map((id) => common.decodeId(id));
        const result = await announcementService.bulkSetAnnouncementStatus(vendorId, req.user._id, decodedIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('announcementController: bulkSetAnnouncementStatus - Exception while bulk updating announcement status', { vendorId, error });
    }
};

const bulkDeleteAnnouncements = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const decodedIds = req.body.announcementIds.map((id) => common.decodeId(id));
        const result = await announcementService.bulkDeleteAnnouncements(vendorId, req.user._id, decodedIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('announcementController: bulkDeleteAnnouncements - Exception while bulk deleting announcements', { vendorId, error });
    }
};

module.exports = {
    addAnnouncement,
    deleteAnnouncement,
    updateAnnouncement,
    getAllAnnouncements,
    getAllAnnouncementsAdmin,
    getAnnouncementById,
    bulkSetAnnouncementStatus,
    bulkDeleteAnnouncements
};