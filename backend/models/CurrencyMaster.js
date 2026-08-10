const mongoose = require('mongoose');

const currencyMasterSchema = mongoose.Schema({
    name: {
        type: String,
        minlength: 2,
        maxlength: 20,
        trim: true,
        required: true
    },
    short_name: {
        type: String,
        minlength: 1,
        maxlength: 5,
        trim: true,
        required: true
    },
    symbol: {
        type: String,
        trim: true,
        required: true
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    symbol_position: {
        type: String,
        enum: ['PREFIX', 'SUFFIX'],
        default: 'PREFIX'
    },
    decimal_places: {
        type: Number,
        default: 2
    },
    country_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CountryMaster',
        default: null
    }
},{
    timestamps: true
});

module.exports = mongoose.model('CurrencyMaster', currencyMasterSchema);