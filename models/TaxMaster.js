const mongoose = require('mongoose');

// Breakdown of a composite tax (e.g. GST 18% = CGST 9% + SGST 9%).
// Needed for invoice line-item compliance even though totalRate below
// gives the single effective rate for quick calculation.
const taxComponentSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true
    },
    rate: {
        type: Number,
        required: true
    }
}, { _id: false });

const taxMasterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Unique short code, e.g. 'IN_GST_18', 'AE_VAT_5'. Useful for lookups
    // from seed scripts / config rather than always going by ObjectId.
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        unique: true
    },
    countryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CountryMaster',
        required: true,
        index: true
    },
    // null = applies to the whole country. Set when a country (e.g. India)
    // needs state-specific rates.
    stateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StateMaster',
        default: null,
        index: true
    },
    hsnCode: {
        type: String,
        trim: true,
        default: null
    },
    sacCode: {
        type: String,
        trim: true,
        default: null
    },
    taxType: {
        type: String,
        enum: ['percentage', 'flat'],
        default: 'percentage',
        required: true
    },
    // The single effective rate (or flat amount) used for calculation.
    // Should equal the sum of components[].rate when components are used.
    totalRate: {
        type: Number,
        required: true
    },
    components: {
        type: [taxComponentSchema],
        default: []
    },
    // Whether product prices already include this tax, or it's added at checkout.
    priceType: {
        type: String,
        enum: ['inclusive', 'exclusive'],
        default: 'exclusive',
        required: true
    },
    // Historical validity window. Never mutate totalRate/components on an
    // existing row once orders have referenced it — close it via
    // applicableTo and create a new TaxMaster row instead, so past orders
    // keep the rate that was actually charged.
    applicableFrom: {
        type: Date,
        required: true,
        default: Date.now
    },
    applicableTo: {
        type: Date,
        default: null
    },
    // Fallback tax for a country/state when a product has no explicit
    // taxIds assigned.
    isDefault: {
        type: Boolean,
        default: false
    },
    precedence: {
        type: Number,
        default: 0
    },

    // Standard mandatory fields. createdBy/updatedBy/etc. here refer to the
    // platform admin user managing tax data, not a vendor.
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    inActiveMarkeddBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true
    },
    activeMarkedBy: {
        type: mongoose.Schema.Types.ObjectId,
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

// Fast lookup of active taxes for a given country/state.
taxMasterSchema.index({ countryId: 1, stateId: 1, status: 1 });

module.exports = mongoose.model('TaxMaster', taxMasterSchema);
