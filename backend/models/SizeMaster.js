const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 30,
        trim: true
    },
    allowedUnits: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'UnitMaster'
        }],
        required: true,
        validate: {
            validator: function (units) {
                return units && units.length > 0;
            },
            message: 'At least one allowed unit is required for a measurement.'
        }
    }
});

const sizeMasterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 40,
        trim: true
    },
    type: {
        type: String,
        enum: ['MEASURABLE', 'LABEL'],
        required: true
    },
    measurements: {
        type: [measurementSchema],
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
        // At least one measurement is required
        if (!this.measurements || this.measurements.length === 0) {
            throw new Error(
                'At least one measurement is required for a measurable size.'
            );
        }

        // LABEL values are not allowed
        if (this.values && this.values.length > 0) {
            throw new Error(
                'Values are not allowed for a measurable size.'
            );
        }

        // Check duplicate measurement labels
        const labels = this.measurements.map(
            measurement => measurement.label.toLowerCase().trim()
        );

        const uniqueLabels = new Set(labels);

        if (labels.length !== uniqueLabels.size) {
            throw new Error(
                'Duplicate measurement labels are not allowed.'
            );
        }
    }

    if (this.type === 'LABEL') {

        // Measurements are not allowed
        if (this.measurements && this.measurements.length > 0) {
            throw new Error(
                'Measurements are not allowed for a label size.'
            );
        }

        // At least one predefined value is required
        if (!this.values || this.values.length === 0) {
            throw new Error(
                'At least one value is required for a label size.'
            );
        }
    }

});

module.exports = mongoose.model('SizeMaster', sizeMasterSchema);