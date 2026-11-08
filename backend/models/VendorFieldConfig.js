const mongoose = require('mongoose');
const {
    FIELD_CONFIG_ENTITIES,
    CUSTOM_FIELD_TYPES,
    CUSTOM_FIELD_PLACEMENTS
} = require('../constants/fieldConfigConstants');

// One vendor's field configuration for ONE entity (module) - see
// constants/fieldConfigConstants.js. A vendor with no document for an entity
// simply gets the standard fields. Written by
// scripts/manageVendorFieldConfig.js (which validates it against the field
// registry first) and read through fieldConfigService (Redis-cached).

const labelOverrideSchema = new mongoose.Schema({
    field: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true }
}, { _id: false });

const customFieldSchema = new mongoose.Schema({
    // Stable id of the field: the JSON key its value is saved under and the
    // Excel column it is read from. Never rename it once values exist.
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: Object.values(CUSTOM_FIELD_TYPES),
        default: CUSTOM_FIELD_TYPES.TEXT
    },
    // select only: the allowed values.
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
    // text only: longest value allowed (null = the global maximum).
    maxLength: { type: Number, default: null },
    placeholder: { type: String, trim: true, default: null },
    placement: {
        mode: {
            type: String,
            enum: Object.values(CUSTOM_FIELD_PLACEMENTS),
            default: CUSTOM_FIELD_PLACEMENTS.END
        },
        // The registry field it replaces / sits next to (not used for 'end').
        field: { type: String, trim: true, default: null }
    },
    // Shown in admin lists/search results (product list, inventory, order product pickers).
    showInAdminLists: { type: Boolean, default: true },
    precedence: { type: Number, default: 0 }
}, { _id: false });

const vendorFieldConfigSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    entity: {
        type: String,
        enum: Object.values(FIELD_CONFIG_ENTITIES),
        required: true
    },
    hiddenFields: { type: [String], default: [] },
    labelOverrides: { type: [labelOverrideSchema], default: [] },
    customFields: { type: [customFieldSchema], default: [] },
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

// At most one live config per vendor per entity. $in because partial indexes can't use $ne.
vendorFieldConfigSchema.index(
    { vendorId: 1, entity: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['A', 'I'] } } }
);

module.exports = mongoose.model('VendorFieldConfig', vendorFieldConfigSchema);
