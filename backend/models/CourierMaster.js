const mongoose = require('mongoose');

// The courier companies a vendor ships with (Courier Master module). An order
// keeps its own copy of the courier's name (Order.courierName) next to
// Order.courierId, so renaming or deleting a courier never changes old
// orders or the emails sent for them.
const courierMasterSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    courierName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    updatedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    deletedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    inActiveMarkedBy: {
        type: mongoose.Types.ObjectId,
        default: null,
        index: true
    },
    activeMarkedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    activeMarkedDate: {
        type: Date,
        default: null
    },
    inactiveMarkedDate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Unique per vendor, case-insensitive ("Blue Dart" = "blue dart"), and only
// among couriers that aren't soft-deleted - matching courierMasterService's
// duplicate check (status $ne 'D'). $in because partial indexes can't use $ne.
const COURIER_NAME_COLLATION = { locale: 'en', strength: 2 };
courierMasterSchema.index(
    { vendorId: 1, courierName: 1 },
    { unique: true, collation: COURIER_NAME_COLLATION, partialFilterExpression: { status: { $in: ['A', 'I'] } } }
);

module.exports = mongoose.model('CourierMaster', courierMasterSchema);
module.exports.COURIER_NAME_COLLATION = COURIER_NAME_COLLATION;
