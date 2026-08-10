const { sendError } = require("../utils/common");

/**
 * Generic, reusable Joi validation middleware - not tied to Address.
 * Usage:
 *   router.post('/', validate(createAddressSchema, 'body'), controller.create);
 *   router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
 *   router.get('/', validate(listQuerySchema, 'query'), controller.list);
 */
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // collect all validation errors, not just the first
      stripUnknown: true, // drop fields not defined in the schema
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message.replace(/"/g, ""),
      }));

      return sendError(res, 400, "Validation failed", errors);
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;