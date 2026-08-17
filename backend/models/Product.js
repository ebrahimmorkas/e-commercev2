const mongoose = require("mongoose");

const bulkPricingSchema = new mongoose.Schema(
    {
        minimumQuantity: {
            type: Number,
            required: true,
            min: 1
        },
        maximumQuantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
);

const descriptionEntrySchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true
        },
        value: {
            type: String,
            required: true,
            trim: true
        }
    },
    { _id: false }
);

const commonFields = {
    status: {
        type: String,
        enum: ["I", "A", "D"],
        default: "A",
        required: true
    },
    precedence: {
        type: Number,
        min: 1
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
    },
    remarks: {
        type: String,
        default: null
    }
};

const policySchema = {
    isAvailable: {
        type: Boolean,
        default: false,
        required: true
    },
    duration: {
        type: Number,
        min: 0,
        default: null
    },
    durationType: {
        type: String,
        enum: ["DAYS", "MONTHS", "YEARS"],
        default: null
    }
};

const shippingSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["CUSTOM", "COMPANY_SETTINGS"],
        required: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { _id: false });

const measurementValueSchema = new mongoose.Schema({
    measurementId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    unit: {
        type: mongoose.Types.ObjectId,
        ref: 'UnitMaster',
        required: true
    },
    value: {
        type: Number,
        required: true
    }
}, { _id: false });

const weightSchema = new mongoose.Schema({
    value: {
        type: Number,
        required: true,
        min: 0
    },
    unit: {
        type: mongoose.Types.ObjectId,
        ref: 'UnitMaster',
        required: true
    }
}, { _id: false });

const sizeSchema = new mongoose.Schema(
    {
        isDefaultSize: {
            type: Boolean,
            default: false
        },
        sizeType: {
            type: String,
            enum: ["MEASURABLE", "LABEL"],
            required: true
        },
        // Vendor-facing display name for this size, entered by the vendor for
        // BOTH types - shown on the frontend instead of the underlying
        // SizeMaster.name (which is only an internal/admin label).
        sizeName: {
            type: String,
            required: true,
            trim: true
        },
        image: {
            url: { type: String, default: null },
            imageAssetId: { type: mongoose.Types.ObjectId, ref: 'ImageAsset', default: null }
        },
        additionalImages: {
            type: [{
                url: { type: String },
                imageAssetId: { type: mongoose.Types.ObjectId, ref: 'ImageAsset' }
            }],
            default: []
        },
        sizeAdditionalDisclaimer: {
            type: String,
            default: null
        },
        sizeAdditionalDescription: {
            type: [descriptionEntrySchema],
            default: []
        },
        sizeAdditionalBulkPricing: {
            type: [bulkPricingSchema],
            default: []
        },
        warranty: {
            type: policySchema,
            default: () => ({
                isAvailable: false
            })
        },
        return: {
            type: policySchema,
            default: () => ({
                isAvailable: false
            })
        },
        exchange: {
            type: policySchema,
            default: () => ({
                isAvailable: false
            })
        },
        shipping: {
            type: shippingSchema,
            default: null
        },
        isDescriptionSameFromVariantsDetails: {
            type: Boolean,
            default: true
        },
        isDisclaimerSameFromVariantsDetails: {
            type: Boolean,
            default: true
        },
        isBulkPricingSameFromVariantsDetails: {
            type: Boolean,
            default: true
        },
        precedence: {
            type: Number,
            min: 1
        },
        excludeCountries: [{
            type: mongoose.Types.ObjectId
        }],
        excludeStates: [{
            type: mongoose.Types.ObjectId
        }],
        excludeCities: [{
            type: mongoose.Types.ObjectId
        }],
        excludeZipCodes: [{
            type: String
        }],
        // Free-text, vendor-entered - NOT a reference to any master collection.
        brand: {
            type: String,
            trim: true,
            default: null
        },
        // Required reference into the (dev-managed, not vendor-facing)
        // SizeMaster collection. The SAME sizeId may legitimately repeat
        // across DIFFERENT sizes within one variant (e.g. shoe sizes 7, 8, 9
        // all referencing a single "Shoe Size" SizeMaster doc) - duplication
        // is only rejected when the resolved VALUE also matches (see
        // validateSizesArray in productValidations.js).
        sizeId: {
            type: mongoose.Types.ObjectId,
            ref: 'SizeMaster',
            required: true
        },

        // MEASURABLE only - one entry per measurement the vendor filled in
        // (partial submission allowed). Never stored on SizeMaster itself -
        // SizeMaster only defines WHICH measurements/units exist, this is
        // the actual per-size data entered against that definition.
        values: {
            type: [measurementValueSchema],
            default: undefined
        },
        // LABEL only - the single value the vendor selected out of
        // SizeMaster.values (e.g. "S" out of ["S","L"]).
        labelValue: {
            type: String,
            default: null
        },
        price: {
            type: Number,
            min: 0,
            required: true
        },
        cancelledPrice: {
            type: Number,
            min: 0,
            default: null
        },
        stock: {
            type: Number,
            min: 0,
            default: 0
        },
        weight: {
            type: weightSchema,
            default: null
        },
        sku: {
            type: String,
            required: true
        },
        barcode: {
            type: String,
            default: null
        },
        sizeCode: {
            type: String,
            default: null
        },
        ...commonFields
    },
    {
        _id: true
    }
);

const variantSchema = new mongoose.Schema(
    {
        isDefaultVariant: {
            type: Boolean,
            default: false
        },
        color: {
            type: String,
            default: null
        },
        displayName: {
            type: String,
            default: null
        },
        sizes: {
            type: [sizeSchema],
            default: []
        },
        variantAdditionalDisclaimer: {
            type: String,
            default: null
        },
        variantAdditionalDescription: {
            type: [descriptionEntrySchema],
            default: []
        },
        variantAdditionalBulkPricing: {
            type: [bulkPricingSchema],
            default: []
        },
        isDescriptionSameFromProductBasicDetails: {
            type: Boolean,
            default: true
        },
        isDisclaimerSameFromProductBasicDetails: {
            type: Boolean,
            default: true
        },
        isBulkPricingSameFromProductBasicDetails: {
            type: Boolean,
            default: true
        },
        variantCode: {
            type: String,
            default: null
        },
        ...commonFields
    },
    {
        _id: true
    }
);

const productSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: [descriptionEntrySchema],
            default: []
        },
        colors: [{
            type: String,
            trim: true
        }],
        mainCategory: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true
        },
        subCategory: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true
        },
        disclaimer: {
            type: String,
            default: null
        },
        searchKeywords: [{
            type: String,
            trim: true
        }],
        recommendedProducts: [{
            type: mongoose.Types.ObjectId
        }],
        taxIds: [{
            type: mongoose.Types.ObjectId
        }],
        precedence: {
            type: Number,
            min: 1
        },
        slug: {
            type: String,
            trim: true,
            lowercase: true,
            index: true
        },
        productCode: {
            type: String,
            trim: true,
            uppercase: true,
            required: true,
            index: true
        },
        bulkPricing: {
            type: [bulkPricingSchema],
            default: []
        },
        variants: {
            type: [variantSchema],
            default: []
        },
        ...commonFields
    },
    {
        timestamps: true
    }
);

productSchema.index({
    vendorId: 1,
    slug: 1
}, { unique: true, sparse: true });

productSchema.index({
    vendorId: 1,
    productCode: 1
}, { unique: true, sparse: true });

productSchema.index({
    vendorId: 1,
    "variants.variantCode": 1
}, { unique: true, sparse: true });

// sku: unique per vendor, across ALL of that vendor's products (matches the
// variantCode scope). Required on every size, so no sparse needed.
productSchema.index({
    vendorId: 1,
    "variants.sizes.sku": 1
}, { unique: true });

// barcode: globally unique across ALL vendors (mirrors a real physical
// barcode) - deliberately NOT scoped by vendorId. Optional field, so sparse.
productSchema.index({
    "variants.sizes.barcode": 1
}, { unique: true, sparse: true });
productSchema.index({
    vendorId: 1,
    status: 1
});

productSchema.index({
    name: "text",
    searchKeywords: "text"
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;