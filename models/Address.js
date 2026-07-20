const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    vendor_id: {
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
addressSchema.index({ user_id: 1, vendor_id: 1, status: 1 });

module.exports = mongoose.model("Address", addressSchema);