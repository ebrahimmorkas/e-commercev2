const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    internalNotes: {
      type: String,
      trim: true,
      default: "",
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["A", "I", "D"],
      default: "A",
      required: true,
      index: true,
    },

    discountType: {
      type: String,
      enum: ["FIXED_PRICE", "PERCENTAGE"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    giveDiscountTo: {
      type: String,
      enum: [
        "ALL_PRODUCTS_ALL_USERS",
        "SPECIFIC_PRODUCTS_ALL_USERS",
        "SPECIFIC_CATEGORIES_ALL_USERS",
        "PRODUCT_GROUP_ALL_USERS",
        "CATEGORY_GROUP_ALL_USERS",
        "USER_GROUP",
        "ALL_PRODUCTS_SPECIFIC_USERS",
        "SPECIFIC_PRODUCTS_SPECIFIC_USERS",
        "SPECIFIC_CATEGORIES_SPECIFIC_USERS",
        "CATEGORY_GROUP_SPECIFIC_USERS",
        "PRODUCT_GROUP_SPECIFIC_USERS",
        "PRODUCT_VARIANTS_SPECIFIC_USERS",
        "PRODUCT_VARIANTS_ALL_USERS",
      ],
      required: true,
    },

    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    userGroupIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserGroup",
      },
    ],

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    productGroupIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductGroup",
      },
    ],

    variantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
      },
    ],

    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    categoryGroupIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CategoryGroup",
      },
    ],

    isDiscountForceClosed: {
      type: Boolean,
      default: false,
    },

    forceClosedReason: {
      type: String,
      trim: true,
      default: "",
    },

    discountValidAboveAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isOngoingDiscount: {
      type: Boolean,
      default: false,
    },

    precedence: {
      type: Number,
      default: 0,
      min: 0,
    },

    numberOfUsersCanUseDiscount: {
      type: Number,
      default: null,
      min: 1,
    },

    isMultipleDiscountUsageOn: {
      type: Boolean,
      default: false,
    },

    isDiscountReusable: {
      type: Boolean,
      default: false,
    },

    discountReusableNumber: {
      type: Number,
      default: null,
      min: 1,
    },

    autoApply: {
      type: Boolean,
      default: false,
    },

    isCouponCodeDiscount: {
      type: Boolean,
      default: false,
    },

    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    firstOrderOnly: {
      type: Boolean,
      default: false,
    },

    isDiscountUsedForFirstTime: {
      type: Boolean,
      default: false,
    },

    isDiscountBasedOnPaymentMethods: {
      type: Boolean,
      default: false,
    },

    discountOnPaymentMethods: [
      {
        type: String,
        trim: true,
      },
    ],

    isDiscountOpenForSpecificHours: {
      type: Boolean,
      default: false,
    },

    isDiscountOpenForSpecificDays: {
      type: Boolean,
      default: false,
    },

    specificDays: [
      {
        type: String,
        enum: [
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
          "SUNDAY",
        ],
      },
    ],

    // Only relevant when isDiscountOpenForSpecificHours is true.
    // Stored as "HH:mm" (24-hour) strings, interpreted in `timezone` below.
    specificHoursStartTime: {
      type: String,
      default: null,
    },

    specificHoursEndTime: {
      type: String,
      default: null,
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },

    isMinimumDiscountQuantityDiscount: {
      type: Boolean,
      default: false,
    },

    minimumQuantity: {
      type: Number,
      default: null,
      min: 1,
    },

    totalUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDiscountGiven: {
      type: Number,
      default: 0,
      min: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // NOTE: name kept exactly as specified in the project's standard-fields list.
    inActiveMarkeddBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    activeMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    activeMarkedDate: {
      type: Date,
      default: null,
    },

    inActiveMarkedDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
|--------------------------------------------------------------------------
| INDEXES
|--------------------------------------------------------------------------
*/

discountSchema.index({ vendorId: 1, status: 1 });

// NOTE: intentionally NOT unique. Coupon-code uniqueness (scoped to active,
// non-expired discounts only) is enforced in discountService.js
// (checkCouponCodeAvailability) instead of at the DB level, so an expired
// discount's coupon code can be reused. This index exists for query speed only.
discountSchema.index(
  { vendorId: 1, couponCode: 1 },
  {
    partialFilterExpression: {
      couponCode: { $type: "string" },
    },
  }
);

discountSchema.index({
  vendorId: 1,
  startDate: 1,
  endDate: 1,
});

discountSchema.index({
  vendorId: 1,
  autoApply: 1,
  status: 1,
});

discountSchema.index({
  vendorId: 1,
  precedence: -1,
});

discountSchema.index({
  vendorId: 1,
  productIds: 1,
});

discountSchema.index({
  vendorId: 1,
  categoryIds: 1,
});

discountSchema.index({
  vendorId: 1,
  variantIds: 1,
});

discountSchema.index({
  vendorId: 1,
  productGroupIds: 1,
});

discountSchema.index({
  vendorId: 1,
  categoryGroupIds: 1,
});

discountSchema.index({
  vendorId: 1,
  userIds: 1,
});

discountSchema.index({
  vendorId: 1,
  userGroupIds: 1,
});

discountSchema.index({
  vendorId: 1,
  totalUsageCount: -1,
});

discountSchema.index({
  vendorId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Discount", discountSchema);