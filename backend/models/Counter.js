const mongoose = require('mongoose');

// Generic atomic counter, reusable for any auto-incrementing field on any
// model (productCode today, potentially variantCode / orderNumber /
// invoiceNumber later). Scoped per vendor + a named sequence so different
// vendors and different sequence types never collide with each other.
const counterSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    sequenceName: {
        type: String,
        required: true,
        trim: true
    },
    value: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

counterSchema.index({ vendorId: 1, sequenceName: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);