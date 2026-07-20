const Joi = require("joi");

const objectId = Joi.string().hex().length(24).message("must be a valid Mongo ObjectId");

const createAddressSchema = Joi.object({
  address_name: Joi.string().trim().min(2).max(50).required(),
  room_no: Joi.string().trim().max(20).required(),
  building: Joi.string().trim().max(100).required(),
  address_in_words: Joi.string().trim().max(250).required(),
  floor: Joi.string().trim().max(20).allow("", null),
  country_id: objectId.required(),
  state_id: objectId.required(),
  city_id: objectId.required(),
  pincode: Joi.string().trim().pattern(/^[0-9A-Za-z\- ]{3,10}$/).required().messages({
    "string.pattern.base": "pincode must be 3-10 characters (letters, numbers, spaces, or hyphens)",
  }),
});

// At least one field required for an update; everything else optional.
const updateAddressSchema = Joi.object({
  address_name: Joi.string().trim().min(2).max(50),
  room_no: Joi.string().trim().max(20),
  building: Joi.string().trim().max(100),
  address_in_words: Joi.string().trim().max(250),
  floor: Joi.string().trim().max(20).allow("", null),
  country_id: objectId,
  state_id: objectId,
  city_id: objectId,
  pincode: Joi.string().trim().pattern(/^[0-9A-Za-z\- ]{3,10}$/).messages({
    "string.pattern.base": "pincode must be 3-10 characters (letters, numbers, spaces, or hyphens)",
  }),
})
  .min(1)
  .messages({ "object.min": "At least one field must be provided to update" });

const addressIdParamSchema = Joi.object({
  id: objectId.required(),
});

module.exports = {
  createAddressSchema,
  updateAddressSchema,
  addressIdParamSchema,
};