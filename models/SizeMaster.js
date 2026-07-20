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
    values: {
        type: [String],
        required: true,
        default: []
    },
    tagged_with_unit: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }
}, {
    timestamps: true
})


module.exports = mongoose.model('SizeMaster', sizeMasterSchema);