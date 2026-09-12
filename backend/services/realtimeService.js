const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/*
|--------------------------------------------------------------------------
| GENERIC REALTIME (SOCKET.IO) SERVICE
|--------------------------------------------------------------------------
| Not tied to any one module - init() is called once from server.js, and
| every module (Abandoned Cart today, others later) pushes updates through
| emitToVendorAdmins(). A socket only ever joins one room: the admin room of
| the vendor its own JWT belongs to, resolved server-side from the token -
| the client never gets to choose which vendor's room it joins.
|
| Deliberately never throws: a realtime push is a best-effort side effect,
| not core business logic, so a failure here must never break the request
| (e.g. add-to-cart) that triggered it. Every function below catches and
| logs internally instead of following the service `throw err;` convention.
*/

let io = null;

const adminRoom = (vendorId) => `vendor:${vendorId}:admin`;

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

        if (user.role !== 'admin') {
            return next(new Error('Only admins may connect to this channel'));
        }

        socket.data.userId = user._id;
        socket.data.vendorId = user.vendorId;
        next();
    } catch (err) {
        logger.logException('Exception in realtimeService socket authentication', { error: err });
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
            socket.join(adminRoom(socket.data.vendorId));

            socket.on('disconnect', () => {
                // No-op for now - socket.io already cleans up room membership.
            });
        });

        logger.logInfo(1, 0, 'Realtime (socket.io) server initialized');
        return io;
    } catch (err) {
        logger.logException('Exception initializing realtimeService', { error: err });
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
        logger.logException('Exception in realtimeService.emitToVendorAdmins', { vendorId, event, error: err });
        return false;
    }
};

module.exports = {
    init,
    emitToVendorAdmins
};
