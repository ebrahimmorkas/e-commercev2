const mongoose = require('mongoose');
const User = require('../models/User');
const FreeCash = require('../models/FreeCash');
const UserFreeCash = require('../models/UserFreeCash');
const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');
const common = require('../utils/common');
const {
    FREE_CASH_EVENT_TYPES,
    REMAINDER_OUTCOMES,
    EXPIRY_REASONS,
    GRANT_STATES,
    REVOKE_ACTIONS,
    FREE_CASH_USAGE_DEFAULT_PAGE_SIZE,
    FREE_CASH_USAGE_MAX_PAGE_SIZE
} = require('../constants/freeCashUsageConstants');

/*
|--------------------------------------------------------------------------
| FREE CASH USAGE
|--------------------------------------------------------------------------
| Read-only: how much Free Cash each customer can spend right now, and the
| full history of every Free Cash they were ever given.
|
| "Active Free Cash" is exactly what the cart would let the customer use at
| this moment (same rule as isGrantUsable in cartService.js): the unused
| balance of every Free Cash that is not revoked, not expired, and whose
| campaign is active and inside its start / end dates. All amounts are in
| the store currency, the one Free Cash is kept in.
|
| Only Free Cash that has actually been issued to a customer counts. Free
| Cash for "all users" or for categories is issued to a customer the first
| time they open their cart, so until then it is not listed here.
|
| The history is rebuilt from each UserFreeCash document: when it was issued,
| its cashUsageHistory / cashRefundHistory / revokeHistory rows, and its
| expiry. Walking those in date order gives the balance after every step,
| which is also how the amount REMOVED on an order is worked out (the store
| not keeping remaining Free Cash) - it was never stored as a number.
*/

const NAME_COLLATION = { locale: 'en', strength: 2 };

const SORT_OPTIONS = {
    NAME: { name: 1, _id: 1 },
    ACTIVE_HIGH_TO_LOW: { activeFreeCash: -1, name: 1, _id: 1 },
    ACTIVE_LOW_TO_HIGH: { activeFreeCash: 1, name: 1, _id: 1 }
};

const toObjectId = (id) => {
    try {
        return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
    } catch (err) {
        throw err;
    }
};

const escapeRegex = (str) => {
    try {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch (err) {
        throw err;
    }
};

const roundMoney = (amount) => {
    try {
        return Math.round((Number(amount) || 0) * 100) / 100;
    } catch (err) {
        throw err;
    }
};

const normalizePaging = (query = {}) => {
    try {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(FREE_CASH_USAGE_MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || FREE_CASH_USAGE_DEFAULT_PAGE_SIZE));
        return { page, limit };
    } catch (err) {
        throw err;
    }
};

// A number sent in the query string, or null when it was left out / blank.
const parseAmount = (value) => {
    try {
        if (value === undefined || value === null || String(value).trim() === '') return null;
        const amount = Number(value);
        return Number.isFinite(amount) ? amount : null;
    } catch (err) {
        throw err;
    }
};

// Campaigns a customer could spend from right now.
const fetchLiveCampaignIds = async (vendorId, now) => {
    try {
        return await FreeCash.find({ vendorId, status: 'A', startDate: { $lte: now }, endDate: { $gte: now } }).distinct('_id');
    } catch (err) {
        throw err;
    }
};

// query: { page, limit, search, minAmount, maxAmount, customerStatus, sort }
// Every customer of the store (active and inactive accounts), each with the
// Free Cash they can spend right now. minAmount / maxAmount narrow the list
// by that amount (both ends included; the same number in both = exactly it).
const fetchCustomersFreeCash = async (vendorId, query) => {
    try {
        const { page, limit } = normalizePaging(query);
        const now = new Date();
        const vendorObjectId = toObjectId(vendorId);
        const liveCampaignIds = await fetchLiveCampaignIds(vendorId, now);

        const statuses = ['A', 'I'].includes(query.customerStatus) ? [query.customerStatus] : ['A', 'I'];
        const userMatch = { vendorId: vendorObjectId, role: 'user', status: { $in: statuses } };

        const search = typeof query.search === 'string' ? query.search.trim() : '';
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            userMatch.$or = [{ name: pattern }, { email: pattern }, { phone_no: pattern }, { username: pattern }];
        }

        const minAmount = parseAmount(query.minAmount);
        const maxAmount = parseAmount(query.maxAmount);
        const amountMatch = {};
        if (minAmount !== null) amountMatch.$gte = minAmount;
        if (maxAmount !== null) amountMatch.$lte = maxAmount;
        const rangeStages = Object.keys(amountMatch).length > 0 ? [{ $match: { activeFreeCash: amountMatch } }] : [];

        const isUsableNow = {
            $and: [
                { $eq: ['$isCashExpired', false] },
                { $eq: ['$isRevoked', false] },
                { $eq: ['$status', 'A'] },
                { $gt: ['$remainingAmount', 0] },
                { $in: ['$freeCashId', liveCampaignIds] }
            ]
        };

        const pipeline = [
            { $match: userMatch },
            {
                $lookup: {
                    from: UserFreeCash.collection.name,
                    localField: '_id',
                    foreignField: 'userId',
                    pipeline: [
                        { $match: { vendorId: vendorObjectId, status: { $ne: 'D' } } },
                        {
                            $group: {
                                _id: null,
                                freeCashCount: { $sum: 1 },
                                totalAssigned: { $sum: '$amount' },
                                totalUsed: { $sum: '$usedAmount' },
                                activeFreeCash: { $sum: { $cond: [isUsableNow, '$remainingAmount', 0] } },
                                activeFreeCashCount: { $sum: { $cond: [isUsableNow, 1, 0] } }
                            }
                        }
                    ],
                    as: 'freeCash'
                }
            },
            {
                $project: {
                    name: 1,
                    email: 1,
                    phone_no: 1,
                    status: 1,
                    freeCashCount: { $ifNull: [{ $first: '$freeCash.freeCashCount' }, 0] },
                    totalAssigned: { $round: [{ $ifNull: [{ $first: '$freeCash.totalAssigned' }, 0] }, 2] },
                    totalUsed: { $round: [{ $ifNull: [{ $first: '$freeCash.totalUsed' }, 0] }, 2] },
                    activeFreeCash: { $round: [{ $ifNull: [{ $first: '$freeCash.activeFreeCash' }, 0] }, 2] },
                    activeFreeCashCount: { $ifNull: [{ $first: '$freeCash.activeFreeCashCount' }, 0] }
                }
            },
            {
                $facet: {
                    rows: [
                        ...rangeStages,
                        { $sort: SORT_OPTIONS[query.sort] || SORT_OPTIONS.NAME },
                        { $skip: (page - 1) * limit },
                        { $limit: limit }
                    ],
                    filtered: [...rangeStages, { $count: 'total' }],
                    // For the whole search, before the amount range is applied.
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalCustomers: { $sum: 1 },
                                customersWithActiveFreeCash: { $sum: { $cond: [{ $gt: ['$activeFreeCash', 0] }, 1, 0] } },
                                totalActiveFreeCash: { $sum: '$activeFreeCash' }
                            }
                        }
                    ]
                }
            }
        ];

        const [result] = await User.aggregate(pipeline).collation(NAME_COLLATION).allowDiskUse(true);
        const total = result?.filtered?.[0]?.total || 0;
        const summary = result?.summary?.[0] || { totalCustomers: 0, customersWithActiveFreeCash: 0, totalActiveFreeCash: 0 };

        return common.returnResult(true, 200, 'Free Cash usage fetched successfully', {
            customers: result?.rows || [],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                hasMore: page * limit < total
            },
            summary: {
                totalCustomers: summary.totalCustomers,
                customersWithActiveFreeCash: summary.customersWithActiveFreeCash,
                totalActiveFreeCash: roundMoney(summary.totalActiveFreeCash)
            }
        });
    } catch (err) {
        throw err;
    }
};

// Where one Free Cash of a customer stands right now.
const resolveGrantState = (grant, campaign, now) => {
    try {
        if (grant.isRevoked) return GRANT_STATES.REVOKED;
        if (grant.isCashExpired) return GRANT_STATES.EXPIRED;
        if (!(grant.remainingAmount > 0)) return GRANT_STATES.USED_UP;
        if (!campaign || campaign.status === 'D') return GRANT_STATES.CAMPAIGN_DELETED;
        if (campaign.status !== 'A' || grant.status !== 'A') return GRANT_STATES.CAMPAIGN_INACTIVE;
        if (now < campaign.startDate) return GRANT_STATES.NOT_STARTED;
        if (now > campaign.endDate) return GRANT_STATES.EXPIRED;
        return GRANT_STATES.ACTIVE;
    } catch (err) {
        throw err;
    }
};

// Every step of one Free Cash in the order it happened, each with the balance
// left after it. `lookups` = { orderNumberById, returnOrderById, adminNameById }.
const buildGrantEvents = (grant, campaign, now, lookups) => {
    try {
        const steps = [{ type: FREE_CASH_EVENT_TYPES.ASSIGNED, date: grant.issuedDate || grant.createdAt, order: 0 }];

        for (const usage of (grant.cashUsageHistory || [])) {
            steps.push({ type: FREE_CASH_EVENT_TYPES.USED, date: usage.usedDate, order: 1, usage });
        }
        for (const refund of (grant.cashRefundHistory || [])) {
            steps.push({ type: FREE_CASH_EVENT_TYPES.REFUNDED, date: refund.refundedDate, order: 2, refund });
        }

        const revokeHistory = grant.revokeHistory || [];
        for (const entry of revokeHistory) {
            steps.push({
                type: entry.action === REVOKE_ACTIONS.RESTORED ? FREE_CASH_EVENT_TYPES.RESTORED : FREE_CASH_EVENT_TYPES.REVOKED,
                date: entry.date,
                order: 3,
                by: entry.by
            });
        }
        // Revoked before revokeHistory existed: only the latest revoke is known.
        const latestRevokeRecorded = revokeHistory.some((entry) => entry.action === REVOKE_ACTIONS.REVOKED
            && grant.revokedDate && new Date(entry.date).getTime() === new Date(grant.revokedDate).getTime());
        if (grant.isRevoked && grant.revokedDate && !latestRevokeRecorded) {
            steps.push({ type: FREE_CASH_EVENT_TYPES.REVOKED, date: grant.revokedDate, order: 3, by: grant.revokedBy });
        }

        // Replaced by a newer Free Cash (the store doesn't allow stacking).
        if (grant.isCashExpired && grant.cashExpiredDate) {
            steps.push({ type: FREE_CASH_EVENT_TYPES.EXPIRED, date: grant.cashExpiredDate, order: 4, reason: EXPIRY_REASONS.REPLACED });
        }

        steps.sort((a, b) => (new Date(a.date).getTime() - new Date(b.date).getTime()) || (a.order - b.order));

        const shared = {
            userFreeCashId: grant._id,
            freeCashId: campaign ? campaign._id : grant.freeCashId,
            freeCashName: campaign ? campaign.freeCashName : 'Deleted Free Cash'
        };
        const events = [];
        let balance = 0;
        // What a revoke took away, so a later restore can show it coming back.
        let heldByRevoke = 0;

        for (const step of steps) {
            const event = { ...shared, type: step.type, date: step.date };

            if (step.type === FREE_CASH_EVENT_TYPES.ASSIGNED) {
                balance = roundMoney(grant.amount);
                event.amount = balance;
            } else if (step.type === FREE_CASH_EVENT_TYPES.USED) {
                const amountUsed = roundMoney(step.usage.amountUsed);
                const remainingAfter = roundMoney(step.usage.remainingAmount);
                // Whatever is missing from the balance beyond what was spent was removed.
                const removedAmount = Math.max(0, roundMoney(balance - amountUsed - remainingAfter));
                event.amount = amountUsed;
                event.removedAmount = removedAmount;
                event.remainderOutcome = removedAmount > 0
                    ? REMAINDER_OUTCOMES.REMOVED
                    : (remainingAfter > 0 ? REMAINDER_OUTCOMES.REMAINED : REMAINDER_OUTCOMES.FULLY_USED);
                event.orderId = step.usage.orderId || null;
                event.orderNumber = step.usage.orderId ? (lookups.orderNumberById.get(step.usage.orderId.toString()) || null) : null;
                balance = remainingAfter;
            } else if (step.type === FREE_CASH_EVENT_TYPES.REFUNDED) {
                event.amount = roundMoney(step.refund.amountRefunded);
                const returnedOrderId = step.refund.orderReturnId ? lookups.returnOrderById.get(step.refund.orderReturnId.toString()) : null;
                event.orderId = returnedOrderId || null;
                event.orderNumber = returnedOrderId ? (lookups.orderNumberById.get(returnedOrderId.toString()) || null) : null;
                balance = roundMoney(step.refund.remainingAmount);
            } else if (step.type === FREE_CASH_EVENT_TYPES.REVOKED) {
                event.amount = balance;
                event.byName = step.by ? (lookups.adminNameById.get(step.by.toString()) || null) : null;
                heldByRevoke = balance;
                balance = 0;
            } else if (step.type === FREE_CASH_EVENT_TYPES.RESTORED) {
                event.amount = heldByRevoke;
                event.byName = step.by ? (lookups.adminNameById.get(step.by.toString()) || null) : null;
                balance = heldByRevoke;
                heldByRevoke = 0;
            } else if (step.type === FREE_CASH_EVENT_TYPES.EXPIRED) {
                event.amount = balance;
                event.reason = step.reason;
                balance = 0;
            }

            event.balanceAfter = balance;
            events.push(event);
        }

        // The campaign's end date passed with an unused balance - never
        // written on the document, the Free Cash just stops being usable.
        const endedUnused = !grant.isRevoked && !grant.isCashExpired && grant.remainingAmount > 0
            && campaign && campaign.endDate && now > campaign.endDate;
        if (endedUnused) {
            events.push({
                ...shared,
                type: FREE_CASH_EVENT_TYPES.EXPIRED,
                date: campaign.endDate,
                amount: roundMoney(grant.remainingAmount),
                reason: EXPIRY_REASONS.CAMPAIGN_ENDED,
                balanceAfter: 0
            });
        }

        return events;
    } catch (err) {
        throw err;
    }
};

// One customer: every Free Cash they were ever given (with where each stands
// now) and the full history across all of them, newest first.
const fetchCustomerFreeCashHistory = async (vendorId, userId) => {
    try {
        const customer = await User.findOne({ _id: userId, vendorId, role: 'user', status: { $ne: 'D' } })
            .select('name email phone_no status')
            .lean();
        if (!customer) {
            return common.returnResult(false, 404, 'Customer not found.');
        }

        const grants = await UserFreeCash.find({ vendorId, userId, status: { $ne: 'D' } }).sort({ issuedDate: -1 }).lean();

        // Deleted campaigns are loaded too - their name still belongs in the history.
        const campaigns = await FreeCash.find({ _id: { $in: grants.map((grant) => grant.freeCashId) }, vendorId })
            .select('freeCashName freeCashAmount startDate endDate status')
            .lean();
        const campaignById = new Map(campaigns.map((campaign) => [campaign._id.toString(), campaign]));

        const returnIds = grants.flatMap((grant) => (grant.cashRefundHistory || []).map((refund) => refund.orderReturnId)).filter(Boolean);
        const orderReturns = returnIds.length > 0
            ? await OrderReturn.find({ _id: { $in: returnIds }, vendorId }).select('orderId').lean()
            : [];
        const returnOrderById = new Map(orderReturns.map((orderReturn) => [orderReturn._id.toString(), orderReturn.orderId]));

        const orderIds = [
            ...grants.flatMap((grant) => (grant.cashUsageHistory || []).map((usage) => usage.orderId)),
            ...orderReturns.map((orderReturn) => orderReturn.orderId)
        ].filter(Boolean);
        const orders = orderIds.length > 0
            ? await Order.find({ _id: { $in: orderIds }, vendorId }).select('orderNumber').lean()
            : [];
        const orderNumberById = new Map(orders.map((order) => [order._id.toString(), order.orderNumber]));

        const adminIds = grants.flatMap((grant) => [grant.revokedBy, ...(grant.revokeHistory || []).map((entry) => entry.by)]).filter(Boolean);
        const admins = adminIds.length > 0
            ? await User.find({ _id: { $in: adminIds }, vendorId }).select('name').lean()
            : [];
        const adminNameById = new Map(admins.map((admin) => [admin._id.toString(), admin.name]));

        const now = new Date();
        const lookups = { orderNumberById, returnOrderById, adminNameById };
        const events = [];
        const freeCashList = [];
        let activeFreeCash = 0;

        for (const grant of grants) {
            const campaign = campaignById.get(grant.freeCashId.toString()) || null;
            const state = resolveGrantState(grant, campaign, now);
            if (state === GRANT_STATES.ACTIVE) {
                activeFreeCash += grant.remainingAmount;
            }

            freeCashList.push({
                userFreeCashId: grant._id,
                freeCashId: grant.freeCashId,
                freeCashName: campaign ? campaign.freeCashName : 'Deleted Free Cash',
                amount: roundMoney(grant.amount),
                usedAmount: roundMoney(grant.usedAmount),
                remainingAmount: roundMoney(grant.remainingAmount),
                // What the customer can spend from it right now.
                activeAmount: state === GRANT_STATES.ACTIVE ? roundMoney(grant.remainingAmount) : 0,
                state,
                issuedDate: grant.issuedDate || grant.createdAt,
                startDate: campaign ? campaign.startDate : null,
                endDate: campaign ? campaign.endDate : null
            });

            events.push(...buildGrantEvents(grant, campaign, now, lookups));
        }

        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return common.returnResult(true, 200, 'Free Cash history fetched successfully', {
            customer,
            activeFreeCash: roundMoney(activeFreeCash),
            freeCash: freeCashList,
            events
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchCustomersFreeCash,
    fetchCustomerFreeCashHistory
};
