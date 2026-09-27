// Realtime (socket.io) constants for the Orders module. The shared channel
// name itself (REALTIME_NOTIFICATION_EVENT = 'admin:notification') is
// module-agnostic and lives in abandonedCartConstants.js - orders just adds
// its own `module` value and notification types on top of it.
const REALTIME_MODULE_ORDERS = 'ORDERS';

const ORDER_NOTIFICATION_TYPES = {
    NEW: 'NEW',
    STATUS_CHANGED: 'STATUS_CHANGED',
    CANCELLED: 'CANCELLED',
    AGENT_ASSIGNED: 'AGENT_ASSIGNED',
    // Sent only to the delivery agent an order was just taken off (changed to
    // another agent, removed, or the order was restarted).
    AGENT_UNASSIGNED: 'AGENT_UNASSIGNED',
    PAYMENT_UPDATED: 'PAYMENT_UPDATED',
    SHIPPING_UPDATED: 'SHIPPING_UPDATED',
    ADDRESS_UPDATED: 'ADDRESS_UPDATED',
    ITEMS_UPDATED: 'ITEMS_UPDATED'
};

module.exports = {
    REALTIME_MODULE_ORDERS,
    ORDER_NOTIFICATION_TYPES
};
