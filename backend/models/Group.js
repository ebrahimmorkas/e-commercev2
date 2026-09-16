const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    groupType: {
      type: String,
      required: true,
      enum: [
        "PRODUCT",
        "CATEGORY",
        "USER",
        "BRAND",
        "ORDER",
        "CUSTOM"
      ],
      index: true,
    },
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
    ],
    membersCount: {
      type: Number,
      default: 0,
    },
    precedence: {
      type: Number,
      default: 0,
      index: true,
    },
    remarks: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ['I', 'A', 'D'],
      default: 'A',
      required: true
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
    inActiveMarkedDate: {
        type: Date,
        default: null
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Group', groupSchema);