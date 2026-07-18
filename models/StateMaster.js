const mongoose = require("mongoose");

const stateMasterSchema = new mongoose.Schema(
  {
    country_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CountryMaster",
      required: true,
    },

    state_name: {
      type: String,
      required: true,
      trim: true,
    },

    short_state_name: {
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

    state_code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("StateMaster", stateMasterSchema);