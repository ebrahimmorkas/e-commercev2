const mongoose = require('mongoose');

const unitMasterSchema = mongoose.Schema({
    name: {
        type: String,
        minlength: 2,
        maxlength: 20,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('UnitMaster', unitMasterSchema);