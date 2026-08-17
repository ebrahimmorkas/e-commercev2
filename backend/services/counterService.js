const Counter = require('../models/Counter');

// Atomically increments and returns the next value in a named per-vendor
// sequence. Safe under concurrent requests - $inc via findOneAndUpdate is
// atomic at the DB level, so two simultaneous requests can never receive
// the same number. upsert:true creates the counter document on first use.
const getNextSequenceValue = async (vendorId, sequenceName) => {
    try {
        const counter = await Counter.findOneAndUpdate(
            { vendorId, sequenceName },
            { $inc: { value: 1 } },
            { upsert: true, new: true }
        );
        return counter.value;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getNextSequenceValue
};