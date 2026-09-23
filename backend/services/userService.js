const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const common = require('../utils/common');
const userLocationService = require('./userLocationService');
require('dotenv').config({ quiet: true });

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);

// Fields safe to expose to the admin UI - never password/googleId/authProvider.
const ADMIN_LIST_PROJECTION = 'name username phone_no whatsapp_no email role status createdAt';
const ADMIN_DETAIL_PROJECTION = 'name username phone_no whatsapp_no email role status country state city authProvider createdAt updatedAt';

const fetchAllUsersAdmin = async (vendorId) => {
    try {
        const users = await User.find(
            { vendorId, role: 'user', status: { $ne: 'D' } },
            ADMIN_LIST_PROJECTION,
            { sort: { name: 1 } }
        );
        return common.returnResult(true, 200, 'Users fetched successfully', { users });
    } catch (err) {
        throw err;
    }
};

// Admin creating a customer account directly - same duplicate-check/hash/create
// mechanics as authService.registerUser, just entered by the admin instead of
// the customer (role stays "user", authProvider stays "local", same as
// registerUser). Gated by the two-layer WebsiteMaster/CompanyMaster
// isAdminAddingUserFeatureAllowed switch, same checkFeatureOnOrOff convention
// as cloneProduct/bulkCloneProducts in productService.js.
const createUserByAdmin = async (vendorId, adminUserId, userData, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isAdminAddingUserFeatureAllowed', 'isAdminAddingUserFeatureAllowed'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const { name, username, email, phone_no, whatsapp_no, password, country, state, city } = userData;

        const locationResult = await userLocationService.validateUserLocation({ countryId: country, stateId: state, cityId: city }, companyMasterData);
        if (!locationResult.isSuccess) {
            return locationResult;
        }

        // whatsapp_no is optional and has its own unique index (vendorId_1_whatsapp_no_1) -
        // must be pre-checked here too, or a duplicate slips past this check and only
        // surfaces as an uncaught E11000 from User.create() below (service catch blocks only
        // `throw err;`, so the controller just logs it and the request hangs with no response).
        const existingUser = await User.findOne({
            vendorId,
            $or: [{ username }, { email }, { phone_no }, ...(whatsapp_no ? [{ whatsapp_no }] : [])]
        });
        if (existingUser) {
            return common.returnResult(false, 409, 'A customer already exists with the given username, email, phone number or WhatsApp number');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await User.create({
            vendorId,
            name,
            username,
            email,
            phone_no,
            whatsapp_no,
            password: hashedPassword,
            authProvider: 'local',
            country,
            state,
            city,
            createdBy: adminUserId
        });

        return common.returnResult(true, 201, 'Customer created successfully', {
            user: { _id: user._id, name: user.name, username: user.username, email: user.email, phone_no: user.phone_no, role: user.role, status: user.status }
        });
    } catch (err) {
        throw err;
    }
};

const fetchUserByIdAdmin = async (vendorId, userId) => {
    try {
        const user = await User.findOne(
            { _id: userId, vendorId, role: 'user', status: { $ne: 'D' } },
            ADMIN_DETAIL_PROJECTION
        );
        if (!user) {
            return common.returnResult(false, 404, 'Customer not found');
        }
        return common.returnResult(true, 200, 'User fetched successfully', { user });
    } catch (err) {
        throw err;
    }
};

// Admin-editable profile fields only - password, role, status and
// authProvider/googleId are intentionally out of scope here: status has its
// own bulk-status endpoint above, and password/role changes need their own
// deliberate flows rather than sliding in through a generic profile update.
const updateUserByAdmin = async (vendorId, adminUserId, targetUserId, updateData, companyMasterData) => {
    try {
        const user = await User.findOne({ _id: targetUserId, vendorId, role: 'user', status: { $ne: 'D' } });
        if (!user) {
            return common.returnResult(false, 404, 'Customer not found');
        }

        // Changing any part of the location re-checks the whole resulting
        // country -> state -> city chain (a new country invalidates the old state).
        const locationTouched = ['country', 'state', 'city'].some((field) => updateData[field] !== undefined);
        if (locationTouched) {
            const locationResult = await userLocationService.validateUserLocation({
                countryId: updateData.country !== undefined ? updateData.country : user.country,
                stateId: updateData.state !== undefined ? updateData.state : user.state,
                cityId: updateData.city !== undefined ? updateData.city : user.city
            }, companyMasterData);
            if (!locationResult.isSuccess) {
                return locationResult;
            }
        }

        const duplicateOr = [];
        if (updateData.username) duplicateOr.push({ username: updateData.username });
        if (updateData.email) duplicateOr.push({ email: updateData.email });
        if (updateData.phone_no) duplicateOr.push({ phone_no: updateData.phone_no });
        if (updateData.whatsapp_no) duplicateOr.push({ whatsapp_no: updateData.whatsapp_no });

        if (duplicateOr.length > 0) {
            const duplicateUser = await User.findOne({
                vendorId,
                _id: { $ne: targetUserId },
                $or: duplicateOr
            });
            if (duplicateUser) {
                return common.returnResult(false, 409, 'Another customer already exists with the given username, email, phone number or WhatsApp number');
            }
        }

        Object.assign(user, updateData);
        user.updated_by = adminUserId;
        await user.save();

        return common.returnResult(true, 200, 'Customer updated successfully', {
            user: {
                _id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                phone_no: user.phone_no,
                whatsapp_no: user.whatsapp_no,
                country: user.country,
                state: user.state,
                city: user.city,
                role: user.role,
                status: user.status
            }
        });
    } catch (err) {
        throw err;
    }
};

// Single-customer status flip used only by the bulk endpoint below - there
// is no single-record "mark active"/"mark inactive" endpoint for customers
// yet, so this is new, minimal, standalone capability.
const setUserStatusForBulk = async (vendorId, userId, targetUserId, status) => {
    try {
        const user = await User.findOne({ _id: targetUserId, vendorId, role: 'user', status: { $ne: 'D' } });
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

const softDeleteUserForBulk = async (vendorId, userId, targetUserId) => {
    try {
        const user = await User.findOne({ _id: targetUserId, vendorId, role: 'user', status: { $ne: 'D' } });
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

// Single-record delete endpoint - shares the soft-delete logic above with
// the bulk-delete endpoint below.
// Gated by the two-layer WebsiteMaster/CompanyMaster
// isPasswordChangeFeatureByAdminAllowed switch (same checkFeatureOnOrOff
// convention as cloneProduct/bulkCloneProducts in productService.js).
const changePasswordByAdmin = async (vendorId, adminUserId, targetUserId, newPassword, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isPasswordChangeFeatureByAdminAllowed', 'isPasswordChangeFeatureByAdminAllowed'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const user = await User.findOne({ _id: targetUserId, vendorId, role: 'user', status: { $ne: 'D' } });
        if (!user) {
            return common.returnResult(false, 404, 'Customer not found');
        }

        if (user.authProvider !== 'local') {
            return common.returnResult(false, 400, `This account signs in via ${user.authProvider} and has no password to change.`);
        }

        user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        user.updated_by = adminUserId;
        await user.save();

        // Force re-login everywhere - an admin-set password must invalidate
        // every session issued under the old one.
        await RefreshToken.deleteMany({ userId: targetUserId });

        return common.returnResult(true, 200, 'Customer password changed successfully');
    } catch (err) {
        throw err;
    }
};

const deleteUserByAdmin = async (vendorId, adminUserId, targetUserId) => {
    try {
        return await softDeleteUserForBulk(vendorId, adminUserId, targetUserId);
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
    createUserByAdmin,
    fetchAllUsersAdmin,
    fetchUserByIdAdmin,
    updateUserByAdmin,
    changePasswordByAdmin,
    deleteUserByAdmin,
    bulkSetUserStatus,
    bulkDeleteUsers
};
