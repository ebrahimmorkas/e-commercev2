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

module.exports = {
    fetchAllUsersAdmin
};
