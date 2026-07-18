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
    image: {
        type: String,
        required: true
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
    inActiveMarkeddBy: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    actveMarkeddBy: {
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
});

module.exports = mongoose.model("Banner", bannerSchema);