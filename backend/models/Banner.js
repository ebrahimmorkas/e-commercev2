const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 20,
        trim: true
    },
    // Exactly one of image/video is set on a given banner, never both, never
    // neither - enforced in the pre('validate') hook below (which media type is
    // actually permitted for a vendor is a CompanyMaster.mediaUploadAllowedInBanner
    // business rule, checked in bannerValidations.js before this ever runs).
    image: {
        type: String
    },
    imageAssetId: {
        type: mongoose.Types.ObjectId,
        ref: 'ImageAsset'
    },
    video: {
        type: String
    },
    videoAssetId: {
        type: mongoose.Types.ObjectId,
        ref: 'VideoAsset'
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    isDefault: {
        type: Boolean,
        default: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
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
    }
}, {
    timestamps: true
});


bannerSchema.pre('validate', function() {
  if (this.endDate <= this.startDate) {
    throw new Error('End Date must be greater than Start Date');
  }

  const hasImage = !!this.image;
  const hasVideo = !!this.video;
  if (hasImage === hasVideo) {
    throw new Error('A banner must have exactly one of image or video, not both or neither.');
  }
});

module.exports = mongoose.model("Banner", bannerSchema);