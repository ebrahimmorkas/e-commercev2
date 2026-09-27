const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');
const OrderStepMaster = require('../models/OrderStepMaster');
const RefreshToken = require('../models/RefreshToken');
const userLocationService = require('./userLocationService');
const orderStepService = require('./orderStepService');
const common = require('../utils/common');
const logger = require('../utils/logger');
const { CLOSED_STEP_CODES } = require('../constants/orderStepConstants');
require('dotenv').config({ quiet: true });

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);
const DELIVERY_AGENT_ROLE = 'deliveryAgent';

// Fields safe to send to the admin UI - never password/googleId/authProvider.
const AGENT_PROJECTION = 'name username phone_no whatsapp_no email role status country state city createdAt updatedAt';

/*
|--------------------------------------------------------------------------
| DELIVERY AGENTS (vendor staff)
|--------------------------------------------------------------------------
| A delivery agent is a User with role 'deliveryAgent', created by the
| vendor's admin. Everything here needs the delivery-agent feature on in
| WebsiteMaster AND the vendor's CompanyMaster. CompanyMaster.
| numberOfDeliveryAgentsAllowed caps how many the vendor may have - active
| and inactive agents count, deleted ones don't. An agent who still has
| orders to deliver can't be deactivated or deleted until those orders are
| given to someone else.
*/
const checkFeature = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        return await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData,
            orderStepService.DELIVERY_AGENT_FEATURE_FLAG, orderStepService.DELIVERY_AGENT_FEATURE_FLAG
        );
    } catch (err) {
        throw err;
    }
};

// Orders an agent still has to deliver: assigned to them, still active, and
// their step change not made yet.
const openOrdersFilter = (vendorId, agentIds) => {
    try {
        return {
            vendorId,
            assignedDeliveryAgentId: Array.isArray(agentIds) ? { $in: agentIds } : agentIds,
            status: { $ne: 'D' },
            isFinalized: { $ne: true },
            currentStepCode: { $nin: CLOSED_STEP_CODES },
            deliveryAgentTransitionAt: null
        };
    } catch (err) {
        throw err;
    }
};

const countOpenOrdersByAgent = async (vendorId, agentIds) => {
    try {
        if (agentIds.length === 0) return new Map();
        const rows = await Order.aggregate([
            { $match: openOrdersFilter(vendorId, agentIds) },
            { $group: { _id: '$assignedDeliveryAgentId', count: { $sum: 1 } } }
        ]);
        return new Map(rows.map((row) => [row._id.toString(), row.count]));
    } catch (err) {
        throw err;
    }
};

const countAgentsTowardsLimit = async (vendorId) => {
    try {
        return await User.countDocuments({ vendorId, role: DELIVERY_AGENT_ROLE, status: { $in: ['A', 'I'] } });
    } catch (err) {
        throw err;
    }
};

// '' from an untouched optional form field is stored as "not set" -
// whatsapp_no has a partial unique index on strings, so '' would collide.
const emptyToUndefined = (value) => {
    try {
        return value === '' || value === null ? undefined : value;
    } catch (err) {
        throw err;
    }
};

// Location is optional for an agent, but when given it must be a full, valid
// country -> state -> city chain the store serves (same check as customers).
const validateOptionalLocation = async ({ country, state, city }, companyMasterData) => {
    try {
        if (!country && !state && !city) return null;
        if (!country || !state || !city) {
            return common.returnResult(false, 400, 'Choose a country, state and city together, or leave all three empty.');
        }
        const result = await userLocationService.validateUserLocation({ countryId: country, stateId: state, cityId: city }, companyMasterData);
        return result.isSuccess ? null : result;
    } catch (err) {
        throw err;
    }
};

// Username/email/phone/WhatsApp are unique across ALL of the vendor's users
// (User's unique indexes), so an agent can't reuse a customer's either.
const findDuplicateUser = async (vendorId, { username, email, phone_no, whatsapp_no }, excludeUserId = null) => {
    try {
        const or = [];
        if (username) or.push({ username });
        if (email) or.push({ email });
        if (phone_no) or.push({ phone_no });
        if (whatsapp_no) or.push({ whatsapp_no });
        if (or.length === 0) return null;
        const filter = { vendorId, $or: or };
        if (excludeUserId) filter._id = { $ne: excludeUserId };
        return await User.findOne(filter).select('_id').lean();
    } catch (err) {
        throw err;
    }
};

const DUPLICATE_MESSAGE = 'Someone in your store (a customer or another agent) already uses this username, email, phone number or WhatsApp number.';

const findAgent = async (vendorId, agentId) => {
    try {
        return await User.findOne({ _id: agentId, vendorId, role: DELIVERY_AGENT_ROLE, status: { $ne: 'D' } });
    } catch (err) {
        throw err;
    }
};

// Every non-deleted agent, with how many orders each still has to deliver,
// and the plan limit - for the Delivery Agents page.
const fetchDeliveryAgents = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const agents = await User.find(
            { vendorId, role: DELIVERY_AGENT_ROLE, status: { $ne: 'D' } },
            AGENT_PROJECTION,
            { sort: { name: 1 } }
        ).lean();
        const openCounts = await countOpenOrdersByAgent(vendorId, agents.map((agent) => agent._id));

        return common.returnResult(true, 200, 'Delivery agents fetched successfully', {
            agents: agents.map((agent) => ({ ...agent, openOrderCount: openCounts.get(agent._id.toString()) || 0 })),
            limit: companyMasterData?.numberOfDeliveryAgentsAllowed ?? 0,
            used: agents.length
        });
    } catch (err) {
        throw err;
    }
};

// Active agents only - the Assign dropdown on an order.
const fetchAssignableDeliveryAgents = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const agents = await User.find(
            { vendorId, role: DELIVERY_AGENT_ROLE, status: 'A' },
            'name phone_no',
            { sort: { name: 1 } }
        ).lean();
        const openCounts = await countOpenOrdersByAgent(vendorId, agents.map((agent) => agent._id));

        return common.returnResult(true, 200, 'Delivery agents fetched successfully', {
            agents: agents.map((agent) => ({ _id: agent._id, name: agent.name, phone_no: agent.phone_no, openOrderCount: openCounts.get(agent._id.toString()) || 0 }))
        });
    } catch (err) {
        throw err;
    }
};

const fetchDeliveryAgentById = async (vendorId, agentId, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const agent = await User.findOne({ _id: agentId, vendorId, role: DELIVERY_AGENT_ROLE, status: { $ne: 'D' } }, AGENT_PROJECTION).lean();
        if (!agent) {
            return common.returnResult(false, 404, 'Delivery agent not found.');
        }
        return common.returnResult(true, 200, 'Delivery agent fetched successfully', { agent });
    } catch (err) {
        throw err;
    }
};

const createDeliveryAgent = async (vendorId, adminUserId, data, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const limit = companyMasterData?.numberOfDeliveryAgentsAllowed ?? 0;
        const used = await countAgentsTowardsLimit(vendorId);
        if (used >= limit) {
            return common.returnResult(false, 403, limit === 0
                ? 'Your plan does not include any delivery agents. Please contact support to add some.'
                : `Your plan allows ${limit} delivery agent${limit === 1 ? '' : 's'} (active and inactive), and you already have ${used}. Delete one you no longer need, or contact support for more.`);
        }

        const fields = {
            name: data.name,
            username: data.username,
            email: data.email,
            phone_no: data.phone_no,
            whatsapp_no: emptyToUndefined(data.whatsapp_no),
            country: emptyToUndefined(data.country),
            state: emptyToUndefined(data.state),
            city: emptyToUndefined(data.city)
        };

        const locationFailure = await validateOptionalLocation(fields, companyMasterData);
        if (locationFailure) {
            return locationFailure;
        }

        if (await findDuplicateUser(vendorId, fields)) {
            return common.returnResult(false, 409, DUPLICATE_MESSAGE);
        }

        const agent = await User.create({
            vendorId,
            ...fields,
            password: await bcrypt.hash(data.password, SALT_ROUNDS),
            role: DELIVERY_AGENT_ROLE,
            authProvider: 'local',
            createdBy: adminUserId
        });

        logger.logInfo(1, 0, 'Delivery agent created', { vendorId, agentId: agent._id });
        return common.returnResult(true, 201, 'Delivery agent created successfully', {
            agent: { _id: agent._id, name: agent.name, username: agent.username, email: agent.email, phone_no: agent.phone_no, whatsapp_no: agent.whatsapp_no, role: agent.role, status: agent.status }
        });
    } catch (err) {
        throw err;
    }
};

const updateDeliveryAgent = async (vendorId, adminUserId, agentId, data, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const agent = await findAgent(vendorId, agentId);
        if (!agent) {
            return common.returnResult(false, 404, 'Delivery agent not found.');
        }

        for (const field of ['name', 'username', 'email', 'phone_no']) {
            if (data[field] !== undefined) agent[field] = data[field];
        }
        // Optional fields: '' / null clears them.
        for (const field of ['whatsapp_no', 'country', 'state', 'city']) {
            if (data[field] !== undefined) agent[field] = emptyToUndefined(data[field]);
        }

        const locationFailure = await validateOptionalLocation({ country: agent.country, state: agent.state, city: agent.city }, companyMasterData);
        if (locationFailure) {
            return locationFailure;
        }

        if (await findDuplicateUser(vendorId, { username: agent.username, email: agent.email, phone_no: agent.phone_no, whatsapp_no: agent.whatsapp_no }, agent._id)) {
            return common.returnResult(false, 409, DUPLICATE_MESSAGE);
        }

        agent.updated_by = adminUserId;
        await agent.save();

        logger.logInfo(1, 0, 'Delivery agent updated', { vendorId, agentId });
        return common.returnResult(true, 200, 'Delivery agent updated successfully', {
            agent: { _id: agent._id, name: agent.name, username: agent.username, email: agent.email, phone_no: agent.phone_no, whatsapp_no: agent.whatsapp_no, role: agent.role, status: agent.status }
        });
    } catch (err) {
        throw err;
    }
};

// The vendor manages its own staff, so this isn't behind the customers'
// isPasswordChangeFeatureByAdminAllowed switch. Signs the agent out everywhere.
const changeDeliveryAgentPassword = async (vendorId, adminUserId, agentId, newPassword, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const agent = await findAgent(vendorId, agentId);
        if (!agent) {
            return common.returnResult(false, 404, 'Delivery agent not found.');
        }

        agent.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        agent.updated_by = adminUserId;
        await agent.save();
        await RefreshToken.deleteMany({ userId: agent._id });

        logger.logInfo(1, 0, 'Delivery agent password changed', { vendorId, agentId });
        return common.returnResult(true, 200, 'Password changed. The agent has been signed out everywhere.');
    } catch (err) {
        throw err;
    }
};

const openOrdersBlockMessage = (agentName, count, action) =>
    `${agentName} still has ${count} order${count === 1 ? '' : 's'} to deliver. Give ${count === 1 ? 'it' : 'them'} to another agent before you ${action} them.`;

const setDeliveryAgentStatus = async (vendorId, adminUserId, agentId, status, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const agent = await findAgent(vendorId, agentId);
        if (!agent) {
            return common.returnResult(false, 404, 'Delivery agent not found.');
        }
        if (agent.status === status) {
            return common.returnResult(false, 400, `This delivery agent is already ${status === 'A' ? 'active' : 'inactive'}.`);
        }

        if (status === 'I') {
            const openCount = await Order.countDocuments(openOrdersFilter(vendorId, agent._id));
            if (openCount > 0) {
                return common.returnResult(false, 409, openOrdersBlockMessage(agent.name, openCount, 'deactivate'));
            }
            agent.inActiveMarkedBy = adminUserId;
            agent.inactiveMarkedDate = new Date();
        } else {
            agent.activeMarkedBy = adminUserId;
            agent.activeMarkedDate = new Date();
        }
        agent.status = status;
        agent.updated_by = adminUserId;
        await agent.save();

        if (status === 'I') {
            await RefreshToken.deleteMany({ userId: agent._id });
        }

        logger.logInfo(1, 0, 'Delivery agent status changed', { vendorId, agentId, status });
        return common.returnResult(true, 200, `Delivery agent ${status === 'A' ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
        throw err;
    }
};

const deleteDeliveryAgent = async (vendorId, adminUserId, agentId, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const agent = await findAgent(vendorId, agentId);
        if (!agent) {
            return common.returnResult(false, 404, 'Delivery agent not found.');
        }

        const openCount = await Order.countDocuments(openOrdersFilter(vendorId, agent._id));
        if (openCount > 0) {
            return common.returnResult(false, 409, openOrdersBlockMessage(agent.name, openCount, 'delete'));
        }

        agent.status = 'D';
        agent.deletedBy = adminUserId;
        agent.updated_by = adminUserId;
        await agent.save();
        await RefreshToken.deleteMany({ userId: agent._id });

        logger.logInfo(1, 0, 'Delivery agent deleted', { vendorId, agentId });
        return common.returnResult(true, 200, 'Delivery agent deleted successfully');
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| THE AGENT'S OWN ORDERS ("My Deliveries")
|--------------------------------------------------------------------------
| Only what an agent needs to deliver - never the order's internals.
*/
const buildAddressText = (order) => {
    try {
        const snapshot = order.shippingAddressSnapshot;
        if (snapshot) {
            return [
                snapshot.addressName,
                [snapshot.roomNo, snapshot.floor ? `Floor ${snapshot.floor}` : null, snapshot.building].filter(Boolean).join(', '),
                snapshot.addressInWords,
                [snapshot.cityName, snapshot.stateName, snapshot.pincode].filter(Boolean).join(', '),
                snapshot.countryName
            ].filter(Boolean).join('\n');
        }
        return order.adminEnteredAddress || order.walkInCustomer?.address || null;
    } catch (err) {
        throw err;
    }
};

const shapeAgentOrder = (order, customer, stepMaster, companySettingsData) => {
    try {
        const transition = stepMaster ? orderStepService.resolveAgentTransition(stepMaster, companySettingsData) : null;
        const isPending = orderStepService.isOrderActive(order) && !order.deliveryAgentTransitionAt;
        const collectAmount = order.isPaymentAtDelivery && order.payment?.status === 'PENDING' ? order.grandTotal : 0;

        return {
            _id: order._id,
            orderNumber: order.orderNumber,
            orderPlacedAt: order.orderPlacedAt,
            currentStepCode: order.currentStepCode,
            currentStepName: order.currentStepName,
            assignedAt: order.deliveryAgentAssignedAt,
            transitionAt: order.deliveryAgentTransitionAt,
            customer: order.isWalkInCustomer
                ? { name: order.walkInCustomer?.name || 'Walk-in customer', phone: order.walkInCustomer?.phone || null, whatsapp: order.walkInCustomer?.whatsapp || null, email: order.walkInCustomer?.email || null }
                : { name: customer?.name || null, phone: customer?.phone_no || null, whatsapp: customer?.whatsapp_no || null, email: customer?.email || null },
            address: buildAddressText(order),
            items: (order.items || []).map((item) => ({ productName: item.productName, variantName: item.variantName, sizeName: item.sizeName, sku: item.sku, quantity: item.quantity })),
            isPaymentAtDelivery: order.isPaymentAtDelivery === true,
            paymentStatus: order.payment?.status || 'PENDING',
            paymentMethod: order.payment?.method || null,
            grandTotal: order.grandTotal,
            amountToCollect: collectAmount,
            currencyCode: order.currencyCode,
            currencySymbol: order.currencySymbol,
            currencySymbolPosition: order.currencySymbolPosition,
            currencyDecimalPlaces: order.currencyDecimalPlaces,
            remarks: order.remarks || null,
            stepChange: transition ? { fromStepName: transition.fromStep.name, toStepName: transition.toStep.name } : null,
            // The button is only live once the order has reached the agent's "from" step.
            canMakeStepChange: isPending && !!transition && order.currentStepSequence === transition.fromStep.sequence
        };
    } catch (err) {
        throw err;
    }
};

// view 'pending': orders the agent still has to deliver. view 'done': the
// ones they (or an admin, standing in for them) already did - latest 50.
const fetchAgentOrders = async (vendorId, agentId, view, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const featureCheck = await checkFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const orders = view === 'done'
            // The agent can't be changed once the step change is made, so they're still the assigned one.
            ? await Order.find({
                vendorId,
                status: { $ne: 'D' },
                assignedDeliveryAgentId: agentId,
                deliveryAgentTransitionAt: { $ne: null }
            }).sort({ deliveryAgentTransitionAt: -1 }).limit(50).lean()
            : await Order.find(openOrdersFilter(vendorId, agentId)).sort({ deliveryAgentAssignedAt: -1 }).lean();

        const customerIds = [...new Set(orders.filter((order) => order.userId).map((order) => order.userId.toString()))];
        const stepMasterIds = [...new Set(orders.map((order) => order.orderStepMasterId.toString()))];
        const [customers, stepMasters] = await Promise.all([
            User.find({ _id: { $in: customerIds }, vendorId }).select('name phone_no whatsapp_no email').lean(),
            OrderStepMaster.find({ _id: { $in: stepMasterIds } }).lean()
        ]);
        const customerMap = new Map(customers.map((customer) => [customer._id.toString(), customer]));
        const stepMasterMap = new Map(stepMasters.map((stepMaster) => [stepMaster._id.toString(), stepMaster]));

        return common.returnResult(true, 200, 'Orders fetched successfully', {
            orders: orders.map((order) => shapeAgentOrder(
                order,
                order.userId ? customerMap.get(order.userId.toString()) : null,
                stepMasterMap.get(order.orderStepMasterId.toString()),
                companySettingsData
            ))
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchDeliveryAgents,
    fetchAssignableDeliveryAgents,
    fetchDeliveryAgentById,
    createDeliveryAgent,
    updateDeliveryAgent,
    changeDeliveryAgentPassword,
    setDeliveryAgentStatus,
    deleteDeliveryAgent,
    fetchAgentOrders
};
