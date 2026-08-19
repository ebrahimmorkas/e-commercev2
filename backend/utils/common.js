const mongoose = require("mongoose");
const crypto = require('crypto');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const CountryMaster = require('../models/CountryMaster');

const sendSuccess = (res, statusCode, message, data = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

const sendError = (res, statusCode, message, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

const returnResult = (isSuccess, statusCode, message, meta = {}) => {
    return {isSuccess, statusCode, message, meta};
}

// Resolves the display name for whichever location cookie IDs are present -
// used only to build the human-readable excludeText message (e.g. "This
// size is not present in Maharashtra."). Matching itself is done by raw ID
// comparison elsewhere; this is purely for the message text.
const resolveLocationNames = async ({ countryId, stateId, cityId }) => {
    try {
        const result = { countryName: null, stateName: null, cityName: null };

        if (countryId && mongoose.Types.ObjectId.isValid(countryId)) {
            const countryDoc = await CountryMaster.findById(countryId);
            if (countryDoc) result.countryName = countryDoc.country_name;
        }
        if (stateId && mongoose.Types.ObjectId.isValid(stateId)) {
            const stateDoc = await StateMaster.findById(stateId);
            if (stateDoc) result.stateName = stateDoc.state_name;
        }
        if (cityId && mongoose.Types.ObjectId.isValid(cityId)) {
            const cityDoc = await CityMaster.findById(cityId);
            if (cityDoc) result.cityName = cityDoc.city_name;
        }

        return result;
    } catch (err) {
        throw err;
    }
};

const validateGeographyExclusions = async ({ excludeCountries = [], excludeStates = [], excludeCities = [], allowedCountries = [] }) => {
    try {
        const allowedCountryIds = new Set((allowedCountries || []).map(id => id.toString()));

        const invalidCountries = (excludeCountries || []).filter(id => !allowedCountryIds.has(id.toString()));
        if (invalidCountries.length > 0) {
            return returnResult(false, 400, `One or more excluded countries are outside your allowed countries: ${invalidCountries.join(', ')}`);
        }

        if (excludeCountries && excludeCountries.length > 0) {
            const countryDocs = await CountryMaster.find({ _id: { $in: excludeCountries }, status: 'A' });
            const foundCountryIds = new Set(countryDocs.map(doc => doc._id.toString()));
            const missingCountries = excludeCountries.filter(id => !foundCountryIds.has(id.toString()));
            if (missingCountries.length > 0) {
                return returnResult(false, 400, `One or more excluded countries not found or inactive: ${missingCountries.join(', ')}`);
            }
        }

        if (excludeStates && excludeStates.length > 0) {
            const stateDocs = await StateMaster.find({ _id: { $in: excludeStates }, status: 'A' });
            const foundStateIds = new Set(stateDocs.map(doc => doc._id.toString()));

            const missingStates = excludeStates.filter(id => !foundStateIds.has(id.toString()));
            if (missingStates.length > 0) {
                return returnResult(false, 400, `One or more excluded states not found or inactive: ${missingStates.join(', ')}`);
            }

            const invalidStates = stateDocs.filter(doc => !allowedCountryIds.has(doc.country_id.toString()));
            if (invalidStates.length > 0) {
                return returnResult(false, 400, `One or more excluded states belong to a country outside your allowed countries.`);
            }
        }

        if (excludeCities && excludeCities.length > 0) {
            const cityDocs = await CityMaster.find({ _id: { $in: excludeCities }, status: 'A' });
            const foundCityIds = new Set(cityDocs.map(doc => doc._id.toString()));

            const missingCities = excludeCities.filter(id => !foundCityIds.has(id.toString()));
            if (missingCities.length > 0) {
                return returnResult(false, 400, `One or more excluded cities not found or inactive: ${missingCities.join(', ')}`);
            }

            const stateIds = cityDocs.map(doc => doc.state_id);
            const relatedStates = await StateMaster.find({ _id: { $in: stateIds } });
            const stateToCountryMap = new Map(relatedStates.map(state => [state._id.toString(), state.country_id.toString()]));

            const invalidCities = cityDocs.filter(doc => {
                const countryId = stateToCountryMap.get(doc.state_id.toString());
                return !countryId || !allowedCountryIds.has(countryId);
            });
            if (invalidCities.length > 0) {
                return returnResult(false, 400, `One or more excluded cities belong to a country outside your allowed countries.`);
            }
        }

        return returnResult(true, 200, 'All Good');
    } catch (err) {
        throw err;
    }
};

const checkFeatureOnOrOff = async (vendorId, websiteMasterData, companyMasterData, websiteMasterField, companyMasterField) => {
    try {
            if (!websiteMasterData[websiteMasterField]) {
                return returnResult(false, 403, websiteMasterData.temporaryFeatureOffMessage);
            }
            
            if (!companyMasterData[companyMasterField]) {
                return returnResult(false, 403, websiteMasterData.featureDisabledForVendorMessage);
            }

            return returnResult(true, 200, `All Good`);
        } catch (err) {
            throw err;        
          }
}

const ID_ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// IMPORTANT: set these in .env before deploying.
// ID_ENCRYPTION_KEY = 64 hex chars (32 bytes)
// ID_ENCRYPTION_IV  = 32 hex chars (16 bytes)
// If not set, a random key/IV is generated per process start, which means
// every encoded productId/reviewId link becomes invalid on restart/redeploy.
const ID_ENCRYPTION_KEY = process.env.ID_ENCRYPTION_KEY
  ? Buffer.from(process.env.ID_ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32);
const ID_ENCRYPTION_IV = process.env.ID_ENCRYPTION_IV
  ? Buffer.from(process.env.ID_ENCRYPTION_IV, 'hex')
  : crypto.randomBytes(16);

// Reversible encoding: raw Mongo ObjectId -> opaque string safe for a URL param.
const encodeId = (id) => {
  try {
    if (!id) return null;
    const cipher = crypto.createCipheriv(ID_ENCRYPTION_ALGORITHM, ID_ENCRYPTION_KEY, ID_ENCRYPTION_IV);
    let encoded = cipher.update(id.toString(), 'utf8', 'base64url');
    encoded += cipher.final('base64url');
    return encoded;
  } catch (err) {
    throw err;
  }
};

// Reverse of encodeId: opaque string from a URL param -> raw Mongo ObjectId string.
const decodeId = (encodedId) => {
  try {
    if (!encodedId) return null;
    const decipher = crypto.createDecipheriv(ID_ENCRYPTION_ALGORITHM, ID_ENCRYPTION_KEY, ID_ENCRYPTION_IV);
    let decoded = decipher.update(encodedId, 'base64url', 'utf8');
    decoded += decipher.final('utf8');
    return decoded;
  } catch (err) {
    throw err;
  }
};

// Validates the ID of documents
// const validateObjectId = (id) => {
//   if (!id) {
//     return { valid: false, message: "ID is required." };
//   }
//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     return { valid: false, message: "Invalid ID format." };
//   }
//   return { valid: true };
// };

// Validates the ID of documents
const validateObjectId = (ids) => {
  // Array of IDs
  if (Array.isArray(ids)) {
    if (ids.length === 0) {
      return {
        valid: false,
        message: "At least one ID is required."
      };
    }

    const invalidIds = [];

    for (const id of ids) {
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        invalidIds.push(id);
      }
    }

    if (invalidIds.length > 0) {
      return {
        valid: false,
        message: "One or more IDs are invalid.",
        invalidIds
      };
    }

    return { valid: true };
  }

  // Single ID
  if (!ids) {
    return {
      valid: false,
      message: "ID is required."
    };
  }

  if (!mongoose.Types.ObjectId.isValid(ids)) {
    return {
      valid: false,
      message: "Invalid ID format."
    };
  }

  return { valid: true };
};

// Validates that a Mongoose model with the given name is registered
const validateModelExists = (Model) => {
  if (!Model || typeof Model !== "function") {
    return { valid: false, message: "Invalid Model provided." };
  }
  const registeredModels = mongoose.modelNames();
  if (!registeredModels.includes(Model.modelName)) {
    return { valid: false, message: `Model "${Model.modelName}" is not present.` };
  }
  return { valid: true };
};

const setActiveStatusToTrue = async (Model, id, userId, vendorId = null) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.valid) return { success: false, message: idCheck.message };
 
  const modelCheck = validateModelExists(Model);
  if (!modelCheck.valid) return { success: false, message: modelCheck.message };
 
  const doc = await Model.findById(id);
  if (!doc) return { success: false, message: "Document not found." };

  // Optional ownership check - only applied when the caller passes a
  // vendorId (models with no vendor scope, e.g. admin-managed masters,
  // simply omit it and this check is skipped entirely).
  if (vendorId !== null && (!doc.vendorId || doc.vendorId.toString() !== vendorId.toString())) {
    return { success: false, message: "Document not found." };
  }
 
  doc.status = 'A';
  doc.activeMarkedBy = userId;
  doc.activeMarkedDate = new Date();
  await doc.save({ validateBeforeSave: false });
 
  return { success: true, document: doc };
};
 
// Sets status to 'I' (inactive)
const setActiveStatusToFalse = async (Model, id, userId, vendorId = null) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.valid) return { success: false, message: idCheck.message };
 
  const modelCheck = validateModelExists(Model);
  if (!modelCheck.valid) return { success: false, message: modelCheck.message };
 
  const doc = await Model.findById(id);
  if (!doc) return { success: false, message: "Document not found." };

  if (vendorId !== null && (!doc.vendorId || doc.vendorId.toString() !== vendorId.toString())) {
    return { success: false, message: "Document not found." };
  }
 
  doc.status = 'I';
  doc.inActiveMarkedBy = userId;
  doc.inactiveMarkedDate = new Date();
  await doc.save({ validateBeforeSave: false });
 
  return { success: true, document: doc };
};
 
// Soft delete - sets status to 'D'
const softDelete = async (Model, id, userId, vendorId = null) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.valid) return { success: false, message: idCheck.message };
 
  const modelCheck = validateModelExists(Model);
  if (!modelCheck.valid) return { success: false, message: modelCheck.message };
 
  const doc = await Model.findById(id);
  if (!doc) return { success: false, message: "Document not found." };

  if (vendorId !== null && (!doc.vendorId || doc.vendorId.toString() !== vendorId.toString())) {
    return { success: false, message: "Document not found." };
  }
 
  doc.status = 'D';
  doc.deletedBy = userId;
  await doc.save({ validateBeforeSave: false });
 
  return { success: true, document: doc };
};

// Hard Delete
const hardDelete = async (Model, id) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.valid) return { success: false, message: idCheck.message };
  const doc = await Model.findByIdAndDelete(id);
  if (!doc) return { success: false, message: "Document not found." };
  return { success: true };
};

// GetAll
const getAll = async (Model, filter = {}, vendorId) => {
    const modelCheck = validateModelExists(Model);
    if (!modelCheck.valid) return { success: false, message: modelCheck.message };
 
    filter.vendorId = vendorId;
    filter.status = filter.status || { $ne: 'D' };
    return await Model.find(filter);
};

// Get Document by ID
const getByID = async (Model, id) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.valid) return { success: false, message: idCheck.message };
  const doc = await Model.findById(id);
  if (!doc) return { success: false, message: "Document not found." };
  return { success: true, document: doc };
};

// Check whether the document exists or not
const checkWhetherDocumentExists = async (Model, ids, vendorId = "not applicable") => {
  // Validate document ID(s)
  const idCheck = validateObjectId(ids);

  if (!idCheck.valid) {
    return idCheck;
  }

  // Validate vendorId only when applicable
  if (vendorId !== "not applicable") {
    const vendorCheck = validateObjectId(vendorId);

    if (!vendorCheck.valid) {
      return vendorCheck;
    }
  }

  const idArray = Array.isArray(ids) ? ids : [ids];

  // Build query
  const query = {
    _id: { $in: idArray }
  };

  if (vendorId !== "not applicable") {
    query.vendorId = vendorId;
  }

  // Fetch only IDs
  const existingDocuments = await Model.find(
    query,
    { _id: 1 }
  ).lean();

  const existingIds = new Set(
    existingDocuments.map(doc => doc._id.toString())
  );

  const missingIds = idArray.filter(
    id => !existingIds.has(id.toString())
  );

  if (missingIds.length > 0) {
    return {
      success: false,
      message: "One or more documents not found.",
      missingIds
    };
  }

  return {
    success: true
  };
};

// Get default document
const getDefault = async (Model, vendorID) => {
  const doc = await Model.findOne({ vendorID, isDefault: true, isActive: true });
  if (!doc) return { success: false, message: "No default document found." };
  return { success: true, document: doc };
};

module.exports = {
  sendSuccess,
  sendError,
  returnResult,
  checkFeatureOnOrOff,
  validateGeographyExclusions,
  resolveLocationNames,
  validateObjectId,
  validateModelExists,
  setActiveStatusToFalse,
  setActiveStatusToTrue,
  softDelete,
  hardDelete,
  getAll,
  getByID,
  getDefault,
  encodeId,
  decodeId,
  checkWhetherDocumentExists
};

