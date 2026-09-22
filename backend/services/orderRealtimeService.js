const realtimeService = require('./realtimeService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const { REALTIME_NOTIFICATION_EVENT } = require('../constants/abandonedCartConstants');
const { REALTIME_USER_NOTIFICATION_EVENT } = require('../constants/realtimeConstants');
const { REALTIME_MODULE_ORDERS, ORDER_NOTIFICATION_TYPES } = require('../constants/orderRealtimeConstants');

// Which changes the order's own customer is told about live. AGENT_ASSIGNED
// is an internal fulfilment detail and stays admin-only.
const CUSTOMER_NOTIFIED_TYPES = [
    ORDER_NOTIFICATION_TYPES.NEW,
    ORDER_NOTIFICATION_TYPES.STATUS_CHANGED,
    ORDER_NOTIFICATION_TYPES.CANCELLED,
    ORDER_NOTIFICATION_TYPES.PAYMENT_UPDATED,
    ORDER_NOTIFICATION_TYPES.SHIPPING_UPDATED,
    ORDER_NOTIFICATION_TYPES.ADDRESS_UPDATED,
    ORDER_NOTIFICATION_TYPES.ITEMS_UPDATED
];

// Best-effort push - never throws, so a notification failure can never break
// the order/payment request that triggered it (the order itself is always
// already saved before this is called). Deliberately kept out of
// orderService.js so paymentService.js can use it too without a circular
// import.
//
// The payload is a small delta, not the order document: it carries just what
// a list row / status badge needs to patch in place, and no customer PII.
// Anything richer (items, addresses, timeline) is re-fetched over REST by the
// client. Admins get it on the shared admin channel; the order's own customer
// (and only them - a private per-user room) gets it on the user channel.
const notifyOrderChanged = (order, type) => {
    try {
        if (!order) return;

        const notification = {
            module: REALTIME_MODULE_ORDERS,
            type,
            data: {
                // Client-facing payload - encoded the same way the REST
                // responses are (see orderController.js's
                // formatOrderForResponse) so the two channels never diverge
                // in id format. order.vendorId/order.userId below stay raw -
                // they're server-internal socket-room routing, not sent here.
                orderId: common.encodeId(order._id),
                orderNumber: order.orderNumber,
                currentStepCode: order.currentStepCode,
                currentStepName: order.currentStepName,
                paymentStatus: order.payment?.status,
                paymentMethod: order.payment?.method,
                updatedAt: order.updatedAt
            }
        };

        realtimeService.emitToVendorAdmins(order.vendorId, REALTIME_NOTIFICATION_EVENT, notification);

        if (CUSTOMER_NOTIFIED_TYPES.includes(type) && order.userId) {
            realtimeService.emitToUser(order.vendorId, order.userId, REALTIME_USER_NOTIFICATION_EVENT, notification);
        }
    } catch (err) {
        logger.logException('Exception in orderRealtimeService.notifyOrderChanged', { orderId: order?._id, type, error: err });
    }
};

module.exports = {
    notifyOrderChanged
};
