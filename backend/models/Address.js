const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    address_name: {
      type: String,
      required: true,
      trim: true,
    },

    room_no: {
      type: String,
      required: true,
      trim: true,
    },

    building: {
      type: String,
      required: true,
      trim: true,
    },

    address_in_words: {
      type: String,
      required: true,
      trim: true,
    },

    floor: {
      type: String,
      trim: true,
      default: null,
    },

    country_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CountryMaster",
      required: true,
    },

    state_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StateMaster",
      required: true,
    },

    city_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CityMaster",
      required: true,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
    },

    // Exactly one address per user+vendor is the default (enforced by the
    // partial unique index below). Used to pre-select the shipping address
    // at checkout and to estimate shipping ("Delivering to ...") on the cart.
    isDefault: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["A", "I", "D"],
      default: "A",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    activeMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    inActiveMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    activeMarkedDate: {
      type: Date,
      default: null,
    },

    inactiveMarkedDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Speeds up the most common query: "give me this user's addresses for this vendor".
addressSchema.index({ userId: 1, vendorId: 1, status: 1 });

// Backstop for the "one default per user+vendor" rule - the service clears the
// previous default first, but two concurrent requests could otherwise both
// win. Partial (not $ne, which Mongo partial indexes don't support) so a
// soft-deleted address never blocks a new default.
addressSchema.index(
  { userId: 1, vendorId: 1 },
  { unique: true, partialFilterExpression: { isDefault: true, status: { $in: ["A", "I"] } }, name: "one_default_address_per_user" }
);

module.exports = mongoose.model("Address", addressSchema);