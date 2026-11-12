const mongoose = require('mongoose');
const { THEME_CODES, DEFAULT_THEME_CODE, FONT_FAMILIES, SECTION_TYPES } = require('../constants/storefrontConstants');

// One config block. A vendor has two copies: `draft` (what they edit and preview)
// and `published` (what shoppers get). Presentation only - never product/order data.
const configSchema = new mongoose.Schema({
    themeCode: { type: String, enum: THEME_CODES, default: DEFAULT_THEME_CODE },
    primaryColor: { type: String, match: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i, default: null },
    fontFamily: { type: String, enum: [...FONT_FAMILIES, null], default: null },
    sections: [{
        _id: false,
        type: { type: String, enum: SECTION_TYPES, required: true },
        enabled: { type: Boolean, default: true },
    }],
}, { _id: false });

const storefrontSettingsSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Types.ObjectId, required: true, unique: true },
    draft: { type: configSchema, default: () => ({}) },
    published: { type: configSchema, default: null }, // null = never published -> defaults
    publishedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Types.ObjectId, default: null },
}, { timestamps: true });

module.exports = mongoose.model('StorefrontSettings', storefrontSettingsSchema);
