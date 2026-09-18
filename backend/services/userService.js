const User = require('../models/User');
const common = require('../utils/common');

// Fields safe to expose to the admin UI - never password/googleId/authProvider.
const ADMIN_LIST_PROJECTION = 'name username phone_no whatsapp_no email role status createdAt';

const fetchAllUsersAdmin = async (vendorId) => {
    try {
        const users = await User.find(
            { vendorId, status: { $ne: 'D' } },
            ADMIN_LIST_PROJECTION,
            { sort: { name: 1 } }
        );
        return common.returnResult(true, 200, 'Users fetched successfully', { users });
    } catch (err) {
        throw err;
    }
};

// Single-customer status flip used only by the bulk endpoint below - there
// is no single-record "mark active"/"mark inactive" endpoint for customers
// yet, so this is new, minimal, standalone capability.
const setUserStatusForBulk = async (vendorId, userId, targetUserId, status) => {
    try {
        const user = await User.findOne({ _id: targetUserId, vendorId, status: { $ne: 'D' } });
        if (!user) {
            return common.returnResult(false, 404, 'Customer not found');
        }

        if (status === 'A') {
            user.activeMarkedBy = userId;
            user.activeMarkedDate = new Date();
        } else {
            user.inActiveMarkedBy = userId;
            user.inactiveMarkedDate = new Date();
        }
        user.status = status;
        user.updated_by = userId;

        await user.save();
        return common.returnResult(true, 200, `Customer ${status === 'A' ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
        throw err;
    }
};

const bulkSetUserStatus = async (vendorId, userId, targetUserIds, status) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            targetUserIds,
            (id) => setUserStatusForBulk(vendorId, userId, id, status)
        );

        return common.returnResult(
            true, 200,
            `${status === 'A' ? 'Activated' : 'Deactivated'} ${successCount} of ${targetUserIds.length} customer(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

// Soft delete only - there is no single-record delete endpoint for
// customers yet, so this is new, minimal, standalone capability.
const softDeleteUserForBulk = async (vendorId, userId, targetUserId) => {
    try {
        const user = await User.findOne({ _id: targetUserId, vendorId, status: { $ne: 'D' } });
        if (!user) {
            return common.returnResult(false, 404, 'Customer not found');
        }

        user.status = 'D';
        user.deletedBy = userId;
        await user.save();

        return common.returnResult(true, 200, 'Customer deleted successfully');
    } catch (err) {
        throw err;
    }
};

const bulkDeleteUsers = async (vendorId, userId, targetUserIds) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            targetUserIds,
            (id) => softDeleteUserForBulk(vendorId, userId, id)
        );

        return common.returnResult(
            true, 200,
            `Deleted ${successCount} of ${targetUserIds.length} customer(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchAllUsersAdmin,
    bulkSetUserStatus,
    bulkDeleteUsers
};
