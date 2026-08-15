const mongoose = require('mongoose');

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

const sizeEntrySchema = new mongoose.Schema({
    isDefault: {
        type: Boolean,
        default: false
    },
    sizeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SizeMaster',
        required: true
    },
    unitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UnitMaster'
    },
    value: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
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
const variantSchema = new mongoose.Schema({
    color: {
        type: String,
        required: true,
        trim: true
    },
    displayName: {
        type: String,
    },
    sizes: {
        type: [sizeEntrySchema],
        default: [],
        validate: {
            validator: (arr) => Array.isArray(arr) && arr.length > 0,
            message: 'At least one size is required per variant.'
        }
    },

    additionalDisclaimer: {
        type: String
    },
    additionalDescription: {
        type: Map,
        of: String
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
    isDescriptionSame: {
        type: Boolean,
        default: true
    },
    isDisclaimerSame: {
        type: Boolean,
        default: true
    },
    isBulkPricingSame: {
        type: Boolean,
        default: true
    },
    precedence: {
        type: Number,
        default: 0
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
    brand: {
        type: String,
        trim: true
    },

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
        type: Map,
        of: String
    },
    colors: {
        type: [String],
        default: []
    },
    
    remarks: {
        type: String,
        enum: ['manual', 'excel'],
        required: true
    },
    variants: {
        type: [variantSchema],
        default: []
    },
    mainCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
    },
    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
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

    bulkPricing: {
        type: [bulkPricingSchema],
        default: []
    },

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
productSchema.index({ vendorId: 1, 'variants.sizes.sku': 1 }, { unique: true, sparse: true });
productSchema.index({ vendorId: 1, 'variants.sizes.variantCode': 1 }, { unique: true, sparse: true });

productSchema.pre('save', function () {
    if (this.variants && this.variants.length > 0) {
        let defaultCount = 0;
        const seenCombinations = new Set();

        for (const variant of this.variants) {
            for (const size of variant.sizes || []) {
                if (size.isDefault === true) defaultCount += 1;

                // CHANGED: was missing `value` from the key, so two sizes
                // expanded from the same sizeId+unitId with different
                // values (e.g. "S" and "M") were wrongly flagged as
                // duplicates. Must match the key shape used in
                // resolveAndValidateVariants in productService.js.
                const key = `${variant.color.trim().toLowerCase()}|${size.sizeId}|${size.unitId}|${(size.value || '').trim().toLowerCase()}`;
                if (seenCombinations.has(key)) {
                    throw new Error('Duplicate color, size and unit combination found across variants.');
                }
                seenCombinations.add(key);
            }
        }

        if (defaultCount > 1) {
            throw new Error('Only one size (across the whole product) can be marked as the default.');
        }
    }
});

module.exports = mongoose.model('Product', productSchema);