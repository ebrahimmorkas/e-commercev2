const Joi = require('joi');
const { THEME_CODES, FONT_FAMILIES, SECTION_TYPES } = require('../../constants/storefrontConstants');

const saveDraftSchema = Joi.object({
    themeCode: Joi.string().valid(...THEME_CODES).required().label('Theme'),
    primaryColor: Joi.string().pattern(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).allow(null, '').label('Primary colour')
        .messages({ 'string.pattern.base': 'Primary colour must be a hex value like #b45309' }),
    fontFamily: Joi.string().valid(...FONT_FAMILIES).allow(null, '').label('Font'),
    sections: Joi.array().items(Joi.object({
        type: Joi.string().valid(...SECTION_TYPES).required(),
        enabled: Joi.boolean().required(),
    })).max(SECTION_TYPES.length).unique('type').required().label('Sections'),
});

module.exports = { saveDraftSchema };
