const mongoose = require('mongoose');
const { timeStamp } = require('node:console');

const sizeMasterSchema = mongoose.Schema({
    name: {
        type: String,        
        required: true,
        minlength: 2,
        maxlength: 20,
        trim: true
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A'
    },
    allowedUnits: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'UnitMaster'
        }],
        required: true,
        validate: {
            validator: (arr) => Array.isArray(arr) && arr.length > 0,
            message: 'At least one allowed unit is required for a size.'
        }
    }
}, {
    timestamps: true
})


module.exports = mongoose.model('SizeMaster', sizeMasterSchema);