// Customer-facing realtime channel. The admin equivalent ('admin:notification')
// lives in abandonedCartConstants.js. The two are deliberately SEPARATE event
// names as well as separate rooms, so a customer socket can never receive
// admin traffic even if a room were ever mis-assigned.
const REALTIME_USER_NOTIFICATION_EVENT = 'user:notification';

// Roles allowed to open a socket. A socket only ever joins the room matching
// its own role (admin room, or its own private per-user room).
const REALTIME_SOCKET_ROLES = {
    ADMIN: 'admin',
    USER: 'user'
};

module.exports = {
    REALTIME_USER_NOTIFICATION_EVENT,
    REALTIME_SOCKET_ROLES
};
