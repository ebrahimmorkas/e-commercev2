// Customer-facing realtime channel. The admin equivalent ('admin:notification')
// lives in abandonedCartConstants.js. The two are deliberately SEPARATE event
// names as well as separate rooms, so a customer socket can never receive
// admin traffic even if a room were ever mis-assigned.
const REALTIME_USER_NOTIFICATION_EVENT = 'user:notification';

// Roles allowed to open a socket. A socket only ever joins the room matching
// its own role: the vendor's admin room, or its own private per-user room (a
// customer, or a delivery agent - who is only ever told about the orders
// assigned to them, on the same private user channel).
const REALTIME_SOCKET_ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    DELIVERY_AGENT: 'deliveryAgent'
};

// The customer's own cart, on the customer channel. Sent when something other
// than the customer changed it, so their open storefront re-reads it.
const REALTIME_MODULE_CART = 'CART';

const CART_NOTIFICATION_TYPES = {
    // An admin placed the order for this cart (Abandoned Carts) and it was emptied.
    EMPTIED: 'EMPTIED'
};

module.exports = {
    REALTIME_MODULE_CART,
    CART_NOTIFICATION_TYPES,
    REALTIME_USER_NOTIFICATION_EVENT,
    REALTIME_SOCKET_ROLES
};
