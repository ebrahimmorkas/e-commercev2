const mongoose = require('mongoose');

const weightMasterSchema = new mongoose.Schema({
    weightName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 40
    },
    weightShortName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20
    },
    symbol: {
        type: String,
        required: true,
        trim: true,
        maxlength: 10
    },
    // Which physical dimension this unit measures. A unit only ever converts
    // against OTHER units of the SAME type when summing a cart's weight for
    // shipping - a MASS unit is never combined with a VOLUME unit (there is
    // no density conversion between the two).
    type: {
        type: String,
        enum: ['MASS', 'VOLUME'],
        required: true
    },
    // How many of this dimension's base unit one unit of THIS entry equals.
    // Base unit per type is a seed-data convention, not enforced by schema:
    // MASS -> Gram (conversionFactor: 1), VOLUME -> Milliliter
    // (conversionFactor: 1). e.g. Kilogram's conversionFactor is 1000.
    conversionFactor: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('WeightMaster', weightMasterSchema);
