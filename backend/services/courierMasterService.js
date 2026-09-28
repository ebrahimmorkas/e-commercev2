const CourierMaster = require('../models/CourierMaster');
const logger = require('../utils/logger');
const common = require('../utils/common');

const getCourierCount = async (vendorId) => {
    try {
        const count = await CourierMaster.countDocuments({ vendorId, status: { $ne: 'D' } });
        return common.returnResult(true, 200, 'Courier count fetched successfully', { count });
    } catch (err) {
        throw err;
    }
};

// Case-insensitive, same collation as the unique index ("blue dart" = "Blue Dart").
const courierNameExists = async (vendorId, courierName, excludeId = null) => {
    try {
        const filter = { vendorId, courierName, status: { $ne: 'D' } };
        if (excludeId) {
            filter._id = { $ne: excludeId };
        }
        return !!(await CourierMaster.exists(filter).collation(CourierMaster.COURIER_NAME_COLLATION));
    } catch (err) {
        throw err;
    }
};

const addCourier = async (vendorId, courierData, userId) => {
    try {
        const courierName = courierData.courierName.trim();

        if (await courierNameExists(vendorId, courierName)) {
            return common.returnResult(false, 409, `Courier "${courierName}" already exists.`);
        }

        const courier = new CourierMaster({
            vendorId,
            courierName,
            createdBy: userId
        });

        const saved = await courier.save();

        logger.logInfo(1, 0, 'Courier added successfully', { vendorId, courierId: saved._id });
        return common.returnResult(true, 201, 'Courier added successfully', { courier: saved });
    } catch (err) {
        throw err;
    }
};

const updateCourier = async (vendorId, courierId, updateData, userId) => {
    try {
        const courier = await CourierMaster.findOne({ _id: courierId, vendorId, status: { $ne: 'D' } });
        if (!courier) {
            return common.returnResult(false, 404, 'Courier not found');
        }

        const { courierName, status } = updateData;

        if (courierName !== undefined) {
            const trimmedName = courierName.trim();
            if (await courierNameExists(vendorId, trimmedName, courierId)) {
                return common.returnResult(false, 409, `Courier "${trimmedName}" already exists.`);
            }
            courier.courierName = trimmedName;
        }

        if (status !== undefined && status !== courier.status) {
            if (status === 'A') {
                courier.activeMarkedBy = userId;
                courier.activeMarkedDate = new Date();
            } else if (status === 'I') {
                courier.inActiveMarkedBy = userId;
                courier.inactiveMarkedDate = new Date();
            }
            courier.status = status;
        }

        courier.updatedBy = userId;

        const updated = await courier.save();
        logger.logInfo(1, 0, 'Courier updated successfully', { vendorId, courierId });
        return common.returnResult(true, 200, 'Courier updated successfully', { courier: updated });
    } catch (err) {
        throw err;
    }
};

// Orders keep their own copy of the courier's name, so deleting a courier
// never changes existing orders - it just can't be picked for new ones.
const softDeleteCourier = async (vendorId, courierId, userId) => {
    try {
        const courier = await CourierMaster.findOne({ _id: courierId, vendorId, status: { $ne: 'D' } });
        if (!courier) {
            return common.returnResult(false, 404, 'Courier not found');
        }

        courier.status = 'D';
        courier.deletedBy = userId;
        await courier.save();

        logger.logInfo(1, 0, 'Courier soft deleted successfully', { vendorId, courierId });
        return common.returnResult(true, 200, 'Courier deleted successfully', {});
    } catch (err) {
        throw err;
    }
};

// Single-courier status flip used only by the bulk endpoint below - mirrors
// the status branch inside updateCourier, with explicit "already" outcomes so
// a bulk run can report them.
const setCourierStatusForBulk = async (vendorId, userId, courierId, status) => {
    try {
        const courier = await CourierMaster.findOne({ _id: courierId, vendorId, status: { $ne: 'D' } });
        if (!courier) {
            return common.returnResult(false, 404, 'Courier not found');
        }
        if (courier.status === status) {
            return common.returnResult(false, 409, status === 'A' ? 'Courier is already active' : 'Courier is already inactive');
        }

        if (status === 'A') {
            courier.activeMarkedBy = userId;
            courier.activeMarkedDate = new Date();
        } else {
            courier.inActiveMarkedBy = userId;
            courier.inactiveMarkedDate = new Date();
        }
        courier.status = status;
        courier.updatedBy = userId;

        await courier.save();
        return common.returnResult(true, 200, `Courier ${status === 'A' ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
        throw err;
    }
};

const bulkSetCourierStatus = async (vendorId, userId, courierIds, status) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            courierIds,
            (id) => setCourierStatusForBulk(vendorId, userId, id, status)
        );

        logger.logInfo(successCount, failureCount, 'Bulk courier status update completed', { vendorId, status, successCount, failureCount });

        return common.returnResult(
            true, 200,
            `${status === 'A' ? 'Activated' : 'Deactivated'} ${successCount} of ${courierIds.length} courier(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

const bulkDeleteCouriers = async (vendorId, userId, courierIds) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            courierIds,
            (id) => softDeleteCourier(vendorId, id, userId)
        );

        logger.logInfo(successCount, failureCount, 'Bulk courier delete completed', { vendorId, successCount, failureCount });

        return common.returnResult(
            true, 200,
            `Deleted ${successCount} of ${courierIds.length} courier(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

// Active + inactive, for the Courier Master page.
const fetchAllCouriersAdmin = async (vendorId) => {
    try {
        const couriers = await CourierMaster.find(
            { vendorId, status: { $in: ['A', 'I'] } },
            null,
            { sort: { courierName: 1 } }
        );
        return common.returnResult(true, 200, 'Couriers fetched successfully', { couriers });
    } catch (err) {
        throw err;
    }
};

// Only active couriers, for the order modal's courier dropdown.
const fetchActiveCouriers = async (vendorId) => {
    try {
        const couriers = await CourierMaster.find(
            { vendorId, status: 'A' },
            'courierName',
            { sort: { courierName: 1 } }
        );
        return common.returnResult(true, 200, 'Couriers fetched successfully', { couriers });
    } catch (err) {
        throw err;
    }
};

const fetchCourierById = async (vendorId, courierId) => {
    try {
        const courier = await CourierMaster.findOne({ _id: courierId, vendorId, status: { $ne: 'D' } });
        if (!courier) {
            return common.returnResult(false, 404, 'Courier not found');
        }
        return common.returnResult(true, 200, 'Courier fetched successfully', { courier });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getCourierCount,
    addCourier,
    updateCourier,
    softDeleteCourier,
    bulkSetCourierStatus,
    bulkDeleteCouriers,
    fetchAllCouriersAdmin,
    fetchActiveCouriers,
    fetchCourierById
};
