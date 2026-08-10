/**
 * Generic helper to resolve a list of business-key values (e.g. product names,
 * category names, user emails parsed out of an uploaded excel sheet) into
 * Mongo ObjectIds by looking them up against any given Mongoose model.
 *
 * Not tied to Discount or any specific module - any service can reuse this.
 *
 * @param {mongoose.Model} Model - the mongoose model to query (e.g. Product, Category, User)
 * @param {String} fieldName - the field on that model to match against (e.g. 'productName', 'email')
 * @param {Array<String>} values - raw values pulled from the excel rows
 * @param {Object} [extraFilter] - additional filter to scope the lookup (e.g. { vendorId })
 *
 * @returns {Promise<{ resolvedIds: Array<ObjectId>, matchedCount: Number, notFound: Array<String> }>}
 */
const resolveEntitiesByField = async (Model, fieldName, values, extraFilter = {}) => {
  try {
    if (!Model || typeof Model.find !== 'function') {
      throw new Error('A valid mongoose Model is required to resolve entities');
    }

    if (!fieldName || typeof fieldName !== 'string') {
      throw new Error('A valid fieldName is required to resolve entities');
    }

    const uniqueValues = [...new Set(
      (values || [])
        .map((v) => (typeof v === 'string' ? v.trim() : v))
        .filter((v) => v !== null && v !== undefined && v !== '')
    )];

    if (uniqueValues.length === 0) {
      return { resolvedIds: [], matchedCount: 0, notFound: [] };
    }

    const filter = { ...extraFilter, [fieldName]: { $in: uniqueValues } };

    const matchedDocs = await Model.find(filter).select(`_id ${fieldName}`).lean();

    const matchedValuesSet = new Set(matchedDocs.map((doc) => doc[fieldName]));
    const notFound = uniqueValues.filter((v) => !matchedValuesSet.has(v));
    const resolvedIds = matchedDocs.map((doc) => doc._id);

    return {
      resolvedIds,
      matchedCount: resolvedIds.length,
      notFound
    };
  } catch (err) {
    throw err;
  }
};

module.exports = {
  resolveEntitiesByField
};