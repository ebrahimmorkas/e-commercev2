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
      // CHANGED: without this, Joi wraps a field's .label() in double
      // quotes inside the message text (e.g. `"Cancelled price" must be
      // greater than the price.`). Turning label wrapping off gives plain,
      // readable prose (`Cancelled price must be greater than the price.`)
      // for every validated route in the app, not just products.
      errors: { wrap: { label: false } },
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        // `field` is the exact dotted/indexed path (e.g.
        // "variants.0.cancelledPrice") so the frontend can pinpoint exactly
        // where the problem is, even inside an array.
        field: detail.path.join("."),
        message: detail.message.replace(/"/g, ""),
      }));

      return sendError(res, 400, "Validation failed", errors);
    }

    if (property === "query") {
      // Express 5 makes req.query a getter-only property (re-parsed from the
      // URL on every read), so a plain `req.query = value` is silently
      // ignored and controllers would get the raw strings - no number/date
      // conversion, no defaults, unknown keys not stripped. An own property
      // on this request shadows that getter.
      Object.defineProperty(req, "query", { value, writable: true, enumerable: true, configurable: true });
    } else {
      req[property] = value;
    }
    next();
  };
};

module.exports = validate;