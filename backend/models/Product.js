const mongoose = require('mongoose');

// Sub-schema for bulk pricing tiers (used only at variant level)
const bulkPricingSchema = new mongoose.Schema({
    minQty: {
        type: Number,
        required: true
    },
    maxQty: {
        type: Number
    },
    pricePerUnit: {
        type: Number,
        required: true
    }
}, { _id: false });

// Sub-schema for each product variant
const variantSchema = new mongoose.Schema({
    isDefault: {
        type: Boolean,
        default: false
    },
    price: {
        type: Number,
        required: true
    },
    cancelledPrice: {
        type: Number
    },
    stock: {
        type: Number,
        required: true,
        default: 0
    },
    lastRestockedDate: {
        type: Date
    },
    additionalDisclaimer: {
        type: String
    },
    additionalDescription: {
        type: String
    },
    image: {
        type: String
    },
    additionalImages: {
        type: [String],
        default: []
    },
    additionalBulkPricing: {
        type: [bulkPricingSchema],
        default: []
    },
    warranty: {
        isAvailable: {
            type: Boolean,
            default: false
        },
        days: {
            type: Number,
            default: null
        }
    },
    return: {
        isAllowed: {
            type: Boolean,
            default: false
        },
        days: {
            type: Number,
            default: null
        }
    },
    exchange: {
        isAllowed: {
            type: Boolean,
            default: false
        },
        days: {
            type: Number,
            default: null
        }
    },
    shipping: {
        type: {
            type: String,
            enum: ['company settings', 'custom'],
            required: true,
            default: 'company settings'
        },
        shippingPrice: {
            type: Number,
            validate: {
                validator: function (value) {
                    // 'this' refers to the shipping subdocument here
                    if (this.type === 'custom') {
                        return value !== null && value !== undefined;
                    }
                    return true;
                },
                message: 'shippingPrice is required when shipping type is custom.'
            }
        }
    },
    precedence: {
        type: Number,
        default: 0
    },
    weight: {
        type: String
    },
    soldCount: {
        type: Number,
        default: 0
    },
    sku: {
        type: String,
        required: true,
        trim: true
    },
    barcode: {
        type: String,
        trim: true
    },
    variantCode: {
        type: String,
        required: true,
        trim: true
    },
    excludeCountries: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CountryMaster'
    }],
    excludeStates: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StateMaster'
    }],
    excludeCities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CityMaster'
    }],
    excludeZipCodes: {
        type: [String],
        default: []
    },

    // Standard mandatory fields (variant-level, since a variant can be
    // independently activated/deactivated/deleted from the rest of the product)
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

const productSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String
    },
    colors: {
        type: [String],
        default: []
    },
    sizeIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SizeMaster'
    }],
    unitIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UnitMaster'
    }],
    remarks: {
        type: String
    },
    variants: {
        type: [variantSchema],
        default: []
    },
    mainCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MainCategory',
        required: true
    },
    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory',
        required: true
    },
    disclaimer: {
        type: String
    },
    brand: {
        type: String,
        trim: true
    },
    searchKeywords: {
        type: [String],
        default: []
    },
    recommendedProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    taxIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaxMaster'
    }],
    precedence: {
        type: Number,
        default: 0
    },
    slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    productCode: {
        type: String,
        required: true,
        trim: true
    },

    // Aggregated review stats, maintained by the service layer whenever a
    // review is created / updated / deleted. Product-wide since reviews are
    // tied to the product, not individual variants (see Review.js).
    averageRating: {
        type: Number,
        default: 0
    },
    totalReviews: {
        type: Number,
        default: 0
    },

    // Standard mandatory fields (product-level)
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

// Uniqueness is scoped per vendor, not global, since this is a multi-vendor
// system and two different vendors may legitimately pick identical values.
productSchema.index({ vendorId: 1, slug: 1 }, { unique: true });
productSchema.index({ vendorId: 1, productCode: 1 }, { unique: true });

// Compound multikey unique indexes on nested variant fields. MongoDB allows
// this as long as only one field in the compound index is an array field.
productSchema.index({ vendorId: 1, 'variants.sku': 1 }, { unique: true, sparse: true });
productSchema.index({ vendorId: 1, 'variants.variantCode': 1 }, { unique: true, sparse: true });

// Enforce that at most one variant is marked as default.
productSchema.pre('save', function (next) {
    if (this.variants && this.variants.length > 0) {
        const defaultVariants = this.variants.filter((variant) => variant.isDefault === true);
        if (defaultVariants.length > 1) {
            return next(new Error('Only one variant can be marked as the default variant.'));
        }
    }
    next();
});

module.exports = mongoose.model('Product', productSchema);
