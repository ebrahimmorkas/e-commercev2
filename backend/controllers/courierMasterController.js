const courierMasterService = require('../services/courierMasterService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const COURIER_FEATURE_FLAG = 'isCourierFeatureOn';

// Converts a CourierMaster mongoose doc (or the slimmer dropdown projection
// from fetchActiveCouriers) into a response-safe object with every ObjectId
// field encoded via common.encodeId.
const formatCourierForResponse = (courierDoc) => {
    if (!courierDoc) return courierDoc;
    const courier = courierDoc.toObject ? courierDoc.toObject() : courierDoc;

    return {
        ...courier,
        _id: courier._id ? common.encodeId(courier._id) : courier._id,
        vendorId: courier.vendorId ? common.encodeId(courier.vendorId) : courier.vendorId,
        createdBy: courier.createdBy ? common.encodeId(courier.createdBy) : courier.createdBy,
        updatedBy: courier.updatedBy ? common.encodeId(courier.updatedBy) : courier.updatedBy,
        deletedBy: courier.deletedBy ? common.encodeId(courier.deletedBy) : courier.deletedBy,
        activeMarkedBy: courier.activeMarkedBy ? common.encodeId(courier.activeMarkedBy) : courier.activeMarkedBy,
        inActiveMarkedBy: courier.inActiveMarkedBy ? common.encodeId(courier.inActiveMarkedBy) : courier.inActiveMarkedBy,
    };
};

const checkCourierFeature = async (req) => {
    try {
        return await common.checkFeatureOnOrOff(req.vendorId, req.websiteMasterData, req.companyMasterData, COURIER_FEATURE_FLAG, COURIER_FEATURE_FLAG);
    } catch (err) {
        throw err;
    }
};

const addCourier = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkCourierFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        // null = unlimited.
        const { numberOfCouriersAllowed } = req.companyMasterData;
        if (numberOfCouriersAllowed != null) {
            const existingCount = await courierMasterService.getCourierCount(vendorId);
            if (existingCount.meta.count >= numberOfCouriersAllowed) {
                return common.sendError(res, 403, 'You have reached the number of couriers allowed');
            }
        }

        const result = await courierMasterService.addCourier(vendorId, req.body, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatCourierForResponse(result.meta.courier));
    } catch (error) {
        logger.logException('courierMasterController: addCourier - Exception while adding courier', { vendorId, error });
    }
};

const updateCourier = async (req, res) => {
    const vendorId = req.vendorId;
    let courierId;
    try {
        const validityResult = await checkCourierFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        courierId = common.decodeId(req.body.courierId);
        const payload = { ...req.body };
        delete payload.courierId;

        const result = await courierMasterService.updateCourier(vendorId, courierId, payload, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatCourierForResponse(result.meta.courier));
    } catch (error) {
        logger.logException('courierMasterController: updateCourier - Exception while updating courier', { vendorId, courierId, error });
    }
};

const deleteCourier = async (req, res) => {
    const vendorId = req.vendorId;
    let courierId;
    try {
        const validityResult = await checkCourierFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        courierId = common.decodeId(req.body.courierId);
        const result = await courierMasterService.softDeleteCourier(vendorId, courierId, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('courierMasterController: deleteCourier - Exception while deleting courier', { vendorId, courierId, error });
    }
};

// Also returns the vendor's courier quota, so the page can show "X of N used".
const getAllCouriersAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkCourierFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await courierMasterService.fetchAllCouriersAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const { numberOfCouriersAllowed } = req.companyMasterData;
        return common.sendSuccess(res, result.statusCode, result.message, {
            couriers: result.meta.couriers.map(formatCourierForResponse),
            numberOfCouriersAllowed: numberOfCouriersAllowed != null ? numberOfCouriersAllowed : null
        });
    } catch (error) {
        logger.logException('courierMasterController: getAllCouriersAdmin - Exception while fetching couriers', { vendorId, error });
    }
};

const getActiveCouriers = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkCourierFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await courierMasterService.fetchActiveCouriers(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.couriers.map(formatCourierForResponse));
    } catch (error) {
        logger.logException('courierMasterController: getActiveCouriers - Exception while fetching active couriers', { vendorId, error });
    }
};

const getCourierById = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        const validityResult = await checkCourierFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        id = common.decodeId(req.params.id);
        const result = await courierMasterService.fetchCourierById(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatCourierForResponse(result.meta.courier));
    } catch (error) {
        logger.logException('courierMasterController: getCourierById - Exception while fetching courier by id', { vendorId, id, error });
    }
};

const bulkSetCourierStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { status } = req.body;
    try {
        const validityResult = await checkCourierFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const decodedIds = req.body.courierIds.map((id) => common.decodeId(id));
        const result = await courierMasterService.bulkSetCourierStatus(vendorId, req.user._id, decodedIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('courierMasterController: bulkSetCourierStatus - Exception while bulk updating courier status', { vendorId, error });
    }
};

const bulkDeleteCouriers = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkCourierFeature(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const decodedIds = req.body.courierIds.map((id) => common.decodeId(id));
        const result = await courierMasterService.bulkDeleteCouriers(vendorId, req.user._id, decodedIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('courierMasterController: bulkDeleteCouriers - Exception while bulk deleting couriers', { vendorId, error });
    }
};

module.exports = {
    addCourier,
    updateCourier,
    deleteCourier,
    getAllCouriersAdmin,
    getActiveCouriers,
    getCourierById,
    bulkSetCourierStatus,
    bulkDeleteCouriers
};
