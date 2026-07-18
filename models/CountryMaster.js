const mongoose = require("mongoose");

const countryMasterSchema = new mongoose.Schema(
  {
    country_name: {
      type: String,
      required: true,
      trim: true,
    },

    short_country_name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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
    
    country_code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },

    phone_code: {
        type: String,
        required: true,
        trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CountryMaster", countryMasterSchema);