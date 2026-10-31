const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const common = require('../utils/common');
const userLocationService = require('./userLocationService');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Product = require('../models/Product');
const {
    CUSTOMER_LIST_SORTS,
    DEFAULT_CUSTOMER_LIST_SORT,
    COUNT_DEPENDENT_SORTS,
    CUSTOMER_ACTIVITY_FILTERS,
    CUSTOMER_LOGIN_FILTERS
} = require('../constants/customerListConstants');
require('dotenv').config({ quiet: true });

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);

// Fields safe to expose to the admin UI - never password/googleId/authProvider.
const ADMIN_LIST_PROJECTION = 'name username phone_no whatsapp_no email role status createdAt';
// Customers page rows (paginated list) - same safe fields plus the counts.
const CUSTOMER_LIST_PROJECTION = {
    name: 1, username: 1, phone_no: 1, whatsapp_no: 1, email: 1, role: 1, status: 1,
    createdAt: 1, lastLoginAt: 1, orderCount: 1, reviewCount: 1
};
// Customers page > a customer's orders (the Orders count drill-down).
const CUSTOMER_ORDER_PROJECTION = 'orderNumber orderPlacedAt createdAt currentStepCode currentStepName payment.status payment.method grandTotal currencyCode currencySymbol currencySymbolPosition currencyDecimalPlaces cancelledAt isPlacedByAdmin';
const ADMIN_DETAIL_PROJECTION ='name username phone_no whatsapp_no email role status country state city authProvider createdAt updatedAt';

// role: 'user' (customers, the default) or 'deliveryAgent' - the Customers
// page lists agents read-only; they are managed on the Delivery Agents page.
const fetchAllUsersAdmin = async (vendorId, role = 'user') => {
    try {
        const users = await User.find(
            { vendorId, role, status: { $ne: 'D' } },
            ADMIN_LIST_PROJECTION,
            { sort: { name: 1 } }
        );
        return common.returnResult(true, 200, 'Users fetched successfully', { users });
    } catch (err) {
        throw err;
    }
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Tie-breakers keep the order stable across pages (equal counts / dates).
const CUSTOMER_SORT_SPECS = {
    [CUSTOMER_LIST_SORTS.NEWEST]: { createdAt: -1, _id: -1 },
    [CUSTOMER_LIST_SORTS.OLDEST]: { createdAt: 1, _id: 1 },
    [CUSTOMER_LIST_SORTS.NAME_ASC]: { name: 1, _id: 1 },
    [CUSTOMER_LIST_SORTS.NAME_DESC]: { name: -1, _id: -1 },
    [CUSTOMER_LIST_SORTS.ORDERS_DESC]: { orderCount: -1, createdAt: -1, _id: -1 },
    [CUSTOMER_LIST_SORTS.ORDERS_ASC]: { orderCount: 1, createdAt: -1, _id: -1 },
    [CUSTOMER_LIST_SORTS.REVIEWS_DESC]: { reviewCount: -1, createdAt: -1, _id: -1 },
    [CUSTOMER_LIST_SORTS.REVIEWS_ASC]: { reviewCount: 1, createdAt: -1, _id: -1 },
    // null sorts before any date ascending and after every date descending, so
    // never-logged-in customers come first / last on their own.
    [CUSTOMER_LIST_SORTS.LOGIN_OLDEST]: { lastLoginAt: 1, createdAt: -1, _id: -1 },
    [CUSTOMER_LIST_SORTS.LOGIN_NEWEST]: { lastLoginAt: -1, createdAt: -1, _id: -1 }
};

// The Customers page's Orders / Reviews columns. Orders: every order that
// isn't deleted - exactly what the admin Orders page lists for this customer
// (cancelled / refunded / awaiting payment included). Reviews: every live
// review (any moderation status), not deleted ones.
const buildCustomerCountStages = (vendorObjectId) => [
    {
        $lookup: {
            from: Order.collection.name,
            let: { customerId: '$_id' },
            pipeline: [
                { $match: { vendorId: vendorObjectId, status: { $ne: 'D' }, $expr: { $eq: ['$userId', '$$customerId'] } } },
                { $count: 'count' }
            ],
            as: 'orderCountResult'
        }
    },
    {
        $lookup: {
            from: Review.collection.name,
            let: { customerId: '$_id' },
            pipeline: [
                { $match: { vendorId: vendorObjectId, status: { $in: ['A', 'I'] }, $expr: { $eq: ['$userId', '$$customerId'] } } },
                { $count: 'count' }
            ],
            as: 'reviewCountResult'
        }
    },
    {
        $addFields: {
            orderCount: { $ifNull: [{ $arrayElemAt: ['$orderCountResult.count', 0] }, 0] },
            reviewCount: { $ifNull: [{ $arrayElemAt: ['$reviewCountResult.count', 0] }, 0] }
        }
    }
];

const activityMatch = (field, filterValue) => (
    filterValue === CUSTOMER_ACTIVITY_FILTERS.HAS ? { [field]: { $gt: 0 } } : { [field]: 0 }
);

/**
 * Admin Customers page: one page of customers (role 'user', not deleted) with
 * each one's order count, review count, joined date and last login.
 * query = { page, limit, q, sort, status, orders, reviews, login, joinedFrom, joinedTo }
 * (already validated - listCustomersAdminQuerySchema).
 */
const fetchCustomersAdminList = async (vendorId, query) => {
    try {
        const { page, limit, q, sort, status, orders, reviews, login, joinedFrom, joinedTo } = query;
        const vendorObjectId = new mongoose.Types.ObjectId(String(vendorId));

        const match = { vendorId: vendorObjectId, role: 'user', status: status || { $ne: 'D' } };
        if (q) {
            const pattern = new RegExp(escapeRegex(q), 'i');
            match.$or = [{ name: pattern }, { username: pattern }, { email: pattern }, { phone_no: pattern }, { whatsapp_no: pattern }];
        }
        if (login === CUSTOMER_LOGIN_FILTERS.NEVER) match.lastLoginAt = null;
        if (login === CUSTOMER_LOGIN_FILTERS.LOGGED_IN) match.lastLoginAt = { $ne: null };
        if (joinedFrom || joinedTo) {
            match.createdAt = {};
            if (joinedFrom) match.createdAt.$gte = new Date(joinedFrom);
            if (joinedTo) match.createdAt.$lte = new Date(joinedTo);
        }

        // Counting is a lookup per customer: only count every matching customer
        // when the sort or a filter needs it, otherwise just the page's.
        const countStages = buildCustomerCountStages(vendorObjectId);
        const needsCountsFirst = COUNT_DEPENDENT_SORTS.includes(sort) || !!orders || !!reviews;
        const countFilter = {
            ...(orders ? activityMatch('orderCount', orders) : {}),
            ...(reviews ? activityMatch('reviewCount', reviews) : {})
        };

        const pipeline = [
            { $match: match },
            ...(needsCountsFirst ? countStages : []),
            ...(Object.keys(countFilter).length > 0 ? [{ $match: countFilter }] : []),
            { $sort: CUSTOMER_SORT_SPECS[sort] || CUSTOMER_SORT_SPECS[DEFAULT_CUSTOMER_LIST_SORT] },
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    users: [
                        { $skip: (page - 1) * limit },
                        { $limit: limit },
                        ...(needsCountsFirst ? [] : countStages),
                        { $project: CUSTOMER_LIST_PROJECTION }
                    ]
                }
            }
        ];

        // Case-insensitive A-Z / Z-A ("alice" next to "Alice", not after "Zed").
        const isNameSort = sort === CUSTOMER_LIST_SORTS.NAME_ASC || sort === CUSTOMER_LIST_SORTS.NAME_DESC;
        const aggregate = User.aggregate(pipeline);
        if (isNameSort) aggregate.collation({ locale: 'en', strength: 2 });

        const [[result], totalCustomers] = await Promise.all([
            aggregate,
            User.countDocuments({ vendorId: vendorObjectId, role: 'user', status: { $ne: 'D' } })
        ]);

        const total = result?.total?.[0]?.count || 0;
        return common.returnResult(true, 200, 'Customers fetched successfully', {
            users: result?.users || [],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                hasMore: page * limit < total
            },
            // Every customer of the store, ignoring search and filters ("12 of 340 customers").
            totalCustomers
        });
    } catch (err) {
        throw err;
    }
};

// The customer must exist in this vendor and not be deleted; staff roles are
// not customers. Returns the user or null.
const findCustomerForAdmin = async (vendorId, userId) => {
    try {
        return await User.findOne({ _id: userId, vendorId, role: 'user', status: { $ne: 'D' } }).select('_id name').lean();
    } catch (err) {
        throw err;
    }
};

// Customers page > click the Orders count: the same orders the count counts.
const fetchCustomerOrdersAdmin = async (vendorId, userId) => {
    try {
        const customer = await findCustomerForAdmin(vendorId, userId);
        if (!customer) {
            return common.returnResult(false, 404, 'Customer not found');
        }

        const orders = await Order.find({ vendorId, userId, status: { $ne: 'D' } })
            .select(CUSTOMER_ORDER_PROJECTION)
            .sort({ orderPlacedAt: -1, createdAt: -1 })
            .lean();

        return common.returnResult(true, 200, 'Customer orders fetched successfully', { customer, orders });
    } catch (err) {
        throw err;
    }
};

// Customers page > click the Reviews count: every live review with its
// moderation status, product and order.
const fetchCustomerReviewsAdmin = async (vendorId, userId) => {
    try {
        const customer = await findCustomerForAdmin(vendorId, userId);
        if (!customer) {
            return common.returnResult(false, 404, 'Customer not found');
        }

        const reviews = await Review.find({ vendorId, userId, status: { $in: ['A', 'I'] } })
            .select('productId orderId variantName sizeName rating title comment moderationStatus status createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const productIds = [...new Set(reviews.map((review) => String(review.productId)))];
        const orderIds = [...new Set(reviews.map((review) => String(review.orderId)))];
        const [products, reviewOrders] = await Promise.all([
            productIds.length > 0 ? Product.find({ _id: { $in: productIds }, vendorId }).select('name').lean() : [],
            orderIds.length > 0 ? Order.find({ _id: { $in: orderIds }, vendorId }).select('orderNumber').lean() : []
        ]);
        const productNameById = new Map(products.map((product) => [String(product._id), product.name]));
        const orderNumberById = new Map(reviewOrders.map((order) => [String(order._id), order.orderNumber]));

        const shaped = reviews.map((review) => ({
            _id: review._id,
            productName: productNameById.get(String(review.productId)) || null,
            orderNumber: orderNumberById.get(String(review.orderId)) || null,
            variantName: review.variantName,
            sizeName: review.sizeName,
            rating: review.rating,
            title: review.title,
            comment: review.comment,
            moderationStatus: review.moderationStatus,
            status: review.status,
            createdAt: review.createdAt
        }));

        return common.returnResult(true, 200, 'Customer reviews fetched successfully', { customer, reviews: shaped });
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
const createUserByAdmin = async (vendorId, adminUserId, userData, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isAdminAddingUserFeatureAllowed', 'isAdminAddingUserFeatureAllowed'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const { name, username, email, phone_no, whatsapp_no, password, country, state, city } = userData;

        // city may be empty when the vendor has "Make City Optional" on.
        const locationResult = await userLocationService.validateUserLocation(
            { countryId: country, stateId: state, cityId: city },
            companyMasterData,
            userLocationService.isCityOptionalForVendor(companySettingsData)
        );
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
            city: city || undefined,
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
const updateUserByAdmin = async (vendorId, adminUserId, targetUserId, updateData, companyMasterData, companySettingsData) => {
    try {
        const user = await User.findOne({ _id: targetUserId, vendorId, role: 'user', status: { $ne: 'D' } });
        if (!user) {
            return common.returnResult(false, 404, 'Customer not found');
        }

        // Changing any part of the location re-checks the whole resulting
        // country -> state -> city chain (a new country invalidates the old state).
        // An empty city ('' / null) clears it - allowed only while the vendor
        // has "Make City Optional" on.
        const locationTouched = ['country', 'state', 'city'].some((field) => updateData[field] !== undefined);
        if (locationTouched) {
            const locationResult = await userLocationService.validateUserLocation({
                countryId: updateData.country !== undefined ? updateData.country : user.country,
                stateId: updateData.state !== undefined ? updateData.state : user.state,
                cityId: updateData.city !== undefined ? updateData.city : user.city
            }, companyMasterData, userLocationService.isCityOptionalForVendor(companySettingsData));
            if (!locationResult.isSuccess) {
                return locationResult;
            }
            // undefined removes the field from the document instead of storing ''.
            if (updateData.city === '' || updateData.city === null) {
                updateData = { ...updateData, city: undefined };
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
    fetchCustomersAdminList,
    fetchCustomerOrdersAdmin,
    fetchCustomerReviewsAdmin,
    fetchUserByIdAdmin,
    updateUserByAdmin,
    changePasswordByAdmin,
    deleteUserByAdmin,
    bulkSetUserStatus,
    bulkDeleteUsers
};
