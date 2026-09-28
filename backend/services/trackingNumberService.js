const crypto = require('crypto');
const Order = require('../models/Order');

// Every order gets its own random tracking number when it's created (and
// older orders get one the first time a courier is set - see
// orderService.setOrderCourier). Random rather than derived from the order
// number, because order numbers are sequential: a customer could otherwise
// guess other orders' tracking numbers and how many orders the store gets.
//
// "TRK-" + 10 characters from an alphabet without look-alikes (0/O, 1/I/L),
// so it's easy to read out over the phone. 31^10 combinations; the
// uniqueness check below is just a safety net.
const TRACKING_PREFIX = 'TRK-';
const TRACKING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TRACKING_LENGTH = 10;
const MAX_ATTEMPTS = 5;

const randomTrackingNumber = () => {
    try {
        let code = '';
        for (let i = 0; i < TRACKING_LENGTH; i++) {
            code += TRACKING_ALPHABET[crypto.randomInt(TRACKING_ALPHABET.length)];
        }
        return `${TRACKING_PREFIX}${code}`;
    } catch (err) {
        throw err;
    }
};

// Unique within the vendor's orders.
const generateUniqueTrackingNumber = async (vendorId) => {
    try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const trackingNumber = randomTrackingNumber();
            const taken = await Order.exists({ vendorId, trackingNumber });
            if (!taken) {
                return trackingNumber;
            }
        }
        throw new Error('Could not generate a unique tracking number');
    } catch (err) {
        throw err;
    }
};

module.exports = {
    generateUniqueTrackingNumber
};
