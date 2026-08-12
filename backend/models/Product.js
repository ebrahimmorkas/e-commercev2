const mongoose = require('mongoose');

// Sub-schema for bulk pricing tiers. Reused at BOTH product level
// (`bulkPricing`, the reusable/base tiers) and variant level
// (`additionalBulkPricing`, the overlay/override tiers) so the shape stays
// identical between the two.
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

    // ADDED: color/sizeId/unitId. Previously these lived only as "palette"
    // arrays on the product (colors[], sizeIds[], unitIds[]) with no field
    // on the variant itself recording WHICH color/size/unit that specific
    // variant represents. color must be one of product.colors, sizeId must
    // be one of product.sizeIds, unitId must be inside sizeId's
    // SizeMaster.allowedUnits — all enforced in the service layer.
    color: {
        type: String,
        required: true,
        trim: true
    },
    sizeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SizeMaster',
        required: true
    },
    unitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UnitMaster',
        required: true
    },

    // Auto-computed server-side as `${color} ${size.name} ${unit.name}`.
    // Never accepted directly from the client.
    name: {
        type: String,
        required: true,
    },
    displayName: {
        type: String,
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
    // System-managed: set by the service whenever an update raises `stock`
    // above its previous value. Never accepted from the client.
    lastRestockedDate: {
        type: Date
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
        // Image upload handled in a later pass (multer + mainImageService).
    },
    additionalImages: {
        type: [String],
        default: []
        // Same as above - deferred.
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
    weight: {
        type: String
    },
    // System-managed by the order pipeline. Never accepted from this CRUD.
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
    brand: {
        type: String,
        trim: true
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
        type: Map,
        of: String
    },
    colors: {
        type: [String],
        default: []
    },
    // NOTE: no product-level sizeIds palette. Unlike colors, Size goes
    // straight from companyMaster.allowedSizes into each variant's Size
    // dropdown - there is no product-level narrowing step for it (see
    // resolveAndValidateVariants in productService.js). REMOVED
    // product-level `unitIds` too — unit is chosen per variant, constrained
    // by that variant's chosen size's allowedUnits.
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

    // ADDED: base/reusable bulk pricing tiers at product level. A variant
    // with isBulkPricingSame=true reads from here; additionalBulkPricing on
    // the variant is an overlay on top of these tiers.
    bulkPricing: {
        type: [bulkPricingSchema],
        default: []
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

productSchema.pre('save', function () {
    if (this.variants && this.variants.length > 0) {
        const defaultVariants = this.variants.filter((variant) => variant.isDefault === true);
        if (defaultVariants.length > 1) {
            throw new Error('Only one variant can be marked as the default variant.');
        }

        const seenCombinations = new Set();
        for (const variant of this.variants) {
            const key = `${variant.color.trim().toLowerCase()}|${variant.sizeId}|${variant.unitId}`;
            if (seenCombinations.has(key)) {
                throw new Error('Duplicate color, size and unit combination found across variants.');
            }
            seenCombinations.add(key);
        }
    }
});

module.exports = mongoose.model('Product', productSchema);