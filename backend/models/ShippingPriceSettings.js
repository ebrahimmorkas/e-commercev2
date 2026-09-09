const mongoose = require('mongoose');
const { VALID_SHIPPING_PRICE_METHODS, CATEGORY_CHARGE_MODES, CATEGORY_AGGREGATIONS } = require('../constants/shippingPriceConstants');

const categoryRuleSchema = new mongoose.Schema({
    categoryId: {
        type: mongoose.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const countryRuleSchema = new mongoose.Schema({
    countryId: {
        type: mongoose.Types.ObjectId,
        ref: 'CountryMaster',
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const stateRuleSchema = new mongoose.Schema({
    stateId: {
        type: mongoose.Types.ObjectId,
        ref: 'StateMaster',
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const cityRuleSchema = new mongoose.Schema({
    cityId: {
        type: mongoose.Types.ObjectId,
        ref: 'CityMaster',
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const zipRuleSchema = new mongoose.Schema({
    zipCode: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

// Ordered, non-overlapping weight tiers in weightUnit. maxWeight: null on the
// last tier means "and above". A total cart weight that falls outside every
// tier (a gap the vendor left uncovered) falls back to weightRestPrice.
const weightBracketSchema = new mongoose.Schema({
    minWeight: {
        type: Number,
        required: true,
        min: 0
    },
    maxWeight: {
        type: Number,
        default: null,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const shippingPriceSettingsSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        unique: true,
        index: true
    },

    // Exactly one of these is ever active at a time - the vendor picks ONE
    // method, never a combination (e.g. category-based AND city-based
    // together is not supported).
    method: {
        type: String,
        enum: VALID_SHIPPING_PRICE_METHODS,
        required: true
    },

    // FIXED
    fixedPrice: {
        type: Number,
        min: 0,
        default: null
    },

    // CATEGORY
    categoryRules: {
        type: [categoryRuleSchema],
        default: []
    },
    // PER_ITEM: a matched category's price is charged per unit of that
    // category in the cart. ONE_TIME: charged once regardless of quantity.
    // Resolved PER category BEFORE categoryAggregation combines them.
    categoryChargeMode: {
        type: String,
        enum: CATEGORY_CHARGE_MODES,
        default: null
    },
    // How each matched category's already-resolved amount is combined
    // across every distinct category present in the cart.
    categoryAggregation: {
        type: String,
        enum: CATEGORY_AGGREGATIONS,
        default: null
    },
    // Fallback price for a cart item whose product category (subCategory,
    // falling back to mainCategory) matches none of categoryRules.
    categoryRestPrice: {
        type: Number,
        min: 0,
        default: null
    },

    // COUNTRY / STATE / CITY / ZIP - exactly one flat price for the whole
    // order, resolved against the shipping address (or, for a cart-page
    // estimate, the browsing location).
    countryRules: {
        type: [countryRuleSchema],
        default: []
    },
    countryRestPrice: {
        type: Number,
        min: 0,
        default: null
    },
    stateRules: {
        type: [stateRuleSchema],
        default: []
    },
    stateRestPrice: {
        type: Number,
        min: 0,
        default: null
    },
    cityRules: {
        type: [cityRuleSchema],
        default: []
    },
    cityRestPrice: {
        type: Number,
        min: 0,
        default: null
    },
    zipRules: {
        type: [zipRuleSchema],
        default: []
    },
    zipRestPrice: {
        type: Number,
        min: 0,
        default: null
    },

    // WEIGHT - total cart weight, converted into this unit via
    // WeightMaster.conversionFactor (only across items whose WeightMaster
    // entry shares the same MASS/VOLUME type as this one - see
    // shippingPriceCalculationService.js), is matched into one of
    // weightBrackets, expressed in this same unit.
    weightUnit: {
        type: mongoose.Types.ObjectId,
        ref: 'WeightMaster',
        default: null
    },
    weightBrackets: {
        type: [weightBracketSchema],
        default: []
    },
    // Fallback when the total cart weight falls outside every bracket.
    weightRestPrice: {
        type: Number,
        min: 0,
        default: null
    },

    // FREE_ABOVE
    freeAboveThreshold: {
        type: Number,
        min: 0,
        default: null
    },
    // Charged when the cart subtotal is below freeAboveThreshold.
    freeAboveFallbackPrice: {
        type: Number,
        min: 0,
        default: null
    },

    createdBy: {
        userID: mongoose.Types.ObjectId,
        vendorID: mongoose.Types.ObjectId
    },
    updatedBy: {
        userID: mongoose.Types.ObjectId,
        vendorID: mongoose.Types.ObjectId
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ShippingPriceSettings', shippingPriceSettingsSchema);
