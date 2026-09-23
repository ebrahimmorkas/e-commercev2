const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { REALTIME_SOCKET_ROLES } = require('../constants/realtimeConstants');

/*
|--------------------------------------------------------------------------
| GENERIC REALTIME (SOCKET.IO) SERVICE
|--------------------------------------------------------------------------
| Not tied to any one module - init() is called once from server.js, and
| every module (Abandoned Cart, Orders, ...) pushes updates through
| emitToVendorAdmins() (admins) or emitToUser() (one customer). A socket only
| ever joins one room, decided server-side from its own JWT - an admin joins
| its vendor's admin room, a customer joins its own private per-user room.
| The client never gets to choose which room it joins.
|
| Deliberately never throws: a realtime push is a best-effort side effect,
| not core business logic, so a failure here must never break the request
| (e.g. add-to-cart) that triggered it. Every function below catches and
| logs internally instead of following the service `throw err;` convention.
*/

let io = null;

const adminRoom = (vendorId) => `vendor:${vendorId}:admin`;
const userRoom = (vendorId, userId) => `vendor:${vendorId}:user:${userId}`;

const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        } catch (err) {
            return next(new Error('Authentication required'));
        }

        const user = await User.findById(decoded.userId);
        if (!user || user.status !== 'A') {
            return next(new Error('Authentication required'));
        }

        if (!Object.values(REALTIME_SOCKET_ROLES).includes(user.role)) {
            return next(new Error('Only admins and customers may connect to this channel'));
        }

        socket.data.userId = user._id;
        socket.data.vendorId = user.vendorId;
        socket.data.role = user.role;
        next();
    } catch (err) {
        logger.logWarning('Exception in realtimeService socket authentication', { error: err });
        next(new Error('Authentication required'));
    }
};

const init = (httpServer) => {
    try {
        io = new Server(httpServer, {
            cors: {
                origin: true,
                credentials: true
            }
        });

        io.use(authenticateSocket);

        io.on('connection', (socket) => {
            // Exactly one room per socket, chosen from the role verified in
            // authenticateSocket - never from anything the client sent.
            if (socket.data.role === REALTIME_SOCKET_ROLES.ADMIN) {
                socket.join(adminRoom(socket.data.vendorId));
            } else {
                socket.join(userRoom(socket.data.vendorId, socket.data.userId));
            }

            socket.on('disconnect', () => {
                // No-op for now - socket.io already cleans up room membership.
            });
        });

        logger.logInfo(1, 0, 'Realtime (socket.io) server initialized');
        return io;
    } catch (err) {
        logger.logWarning('Exception initializing realtimeService', { error: err });
        return null;
    }
};

// Generic push to every admin connection of one vendor. `event` is normally
// the shared REALTIME_NOTIFICATION_EVENT constant; `payload` should carry a
// `module` field so subscribers can filter (see abandonedCartConstants.js).
const emitToVendorAdmins = (vendorId, event, payload) => {
    try {
        if (!io || !vendorId) return false;
        io.to(adminRoom(vendorId)).emit(event, payload);
        return true;
    } catch (err) {
        logger.logWarning('Exception in realtimeService.emitToVendorAdmins', { vendorId, event, error: err });
        return false;
    }
};

// Push to one customer's own connections (every open tab/device of theirs).
// `vendorId` is part of the room name so a user id can never collide across
// vendors.
const emitToUser = (vendorId, userId, event, payload) => {
    try {
        if (!io || !vendorId || !userId) return false;
        io.to(userRoom(vendorId, userId)).emit(event, payload);
        return true;
    } catch (err) {
        logger.logWarning('Exception in realtimeService.emitToUser', { vendorId, userId, event, error: err });
        return false;
    }
};

module.exports = {
    init,
    emitToVendorAdmins,
    emitToUser
};
