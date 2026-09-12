// Generic realtime channel - every module pushes admin notifications through
// this single socket.io event name, distinguished by `module`. See
// services/realtimeService.js. Abandoned Cart is the first consumer.
const REALTIME_NOTIFICATION_EVENT = 'admin:notification';

const REALTIME_MODULE_ABANDONED_CART = 'ABANDONED_CART';

const ABANDONED_CART_NOTIFICATION_TYPES = {
    NEW: 'NEW',
    RECOVERED: 'RECOVERED'
};

// How a flagged/listed abandoned "customer" row was identified - purely
// informational, shown to the admin so they know how sure we are of who
// this is. GUEST_KNOWN means the possibleUserId cookie hint, not an actual
// authenticated session - see Cart.possibleUserId. COMBINED means the same
// customer had both a stale logged-in cart AND a stale not-logged-in guest
// cart at once, folded into one row/alert.
const ABANDONED_CART_SOURCES = {
    LOGGED_IN: 'LOGGED_IN',
    GUEST_KNOWN: 'GUEST_KNOWN',
    COMBINED: 'COMBINED'
};

// How often the background scanner checks for carts that just crossed their
// vendor's configured abandonment window. Kept well under the smallest
// sane timeForAbondonedCartReflection value (minutes) so detection lag stays
// small relative to the configured window.
const ABANDONED_CART_SCAN_INTERVAL_MS = 45 * 1000;

// Used when a vendor has isAbondonedCartFeatureOn but CompanySettings hasn't
// set timeForAbondonedCartReflection yet.
const DEFAULT_ABANDONED_CART_MINUTES = 30;

module.exports = {
    REALTIME_NOTIFICATION_EVENT,
    REALTIME_MODULE_ABANDONED_CART,
    ABANDONED_CART_NOTIFICATION_TYPES,
    ABANDONED_CART_SOURCES,
    ABANDONED_CART_SCAN_INTERVAL_MS,
    DEFAULT_ABANDONED_CART_MINUTES
};
