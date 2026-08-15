const mongoose = require('mongoose');

const sizeMasterSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 20,
        trim: true
    },

    type: {
        type: String,
        enum: ['MEASURABLE', 'LABEL'],
        required: true
    },

    allowedUnits: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'UnitMaster'
        }],
        default: []
    },

    values: {
        type: [String],
        default: []
    },

    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A'
    }
}, {
    timestamps: true
});

sizeMasterSchema.pre('validate', function () {
    if (this.type === 'MEASURABLE') {
        if (!this.allowedUnits || this.allowedUnits.length === 0) {
            throw new Error(
                'At least one allowed unit is required for a measurable size.'
            );
        }

        if (this.values && this.values.length > 0) {
            throw new Error(
                'Values are not allowed for a measurable size.'
            );
        }
    }

    if (this.type === 'LABEL') {
        if (this.allowedUnits && this.allowedUnits.length > 0) {
            throw new Error(
                'Units are not allowed for a label size.'
            );
        }

        if (!this.values || this.values.length === 0) {
            throw new Error(
                'At least one value is required for a label size.'
            );
        }
    }
});

module.exports = mongoose.model('SizeMaster', sizeMasterSchema);