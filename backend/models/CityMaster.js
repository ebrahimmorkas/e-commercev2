const mongoose = require("mongoose");

const cityMasterSchema = new mongoose.Schema(
  {
    state_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StateMaster",
      required: true,
    },

    city_name: {
      type: String,
      required: true,
      trim: true,
    },

    short_city_name: {
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CityMaster", cityMasterSchema);