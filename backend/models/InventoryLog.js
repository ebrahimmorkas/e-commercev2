const mongoose = require('mongoose');
const { VALID_INVENTORY_LOG_TYPES, MAX_REMARK_LENGTH } = require('../constants/inventoryConstants');

// One stock movement of one product size: the stock it was created with, or
// an increase / deduction made from the Inventory module. Stock changed by
// orders is not recorded here. The product, variant and size names are copied
// in, so the history still reads correctly after a rename or a delete.
const inventoryLogSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    variantId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    sizeId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    variantName: {
        type: String,
        trim: true,
        default: null
    },
    sizeName: {
        type: String,
        trim: true,
        default: null
    },
    sku: {
        type: String,
        trim: true,
        default: null
    },
    type: {
        type: String,
        enum: VALID_INVENTORY_LOG_TYPES,
        required: true
    },
    // Always positive - `type` says whether it was added or taken off.
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    previousStock: {
        type: Number,
        required: true,
        min: 0
    },
    newStock: {
        type: Number,
        required: true,
        min: 0
    },
    remark: {
        type: String,
        trim: true,
        maxlength: MAX_REMARK_LENGTH,
        default: null
    },
    // Shared by every row of one bulk adjustment; null for a single one.
    batchId: {
        type: String,
        default: null,
        index: true
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

// The History tab (newest first), and one size's own history.
inventoryLogSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
inventoryLogSchema.index({ vendorId: 1, sizeId: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);
