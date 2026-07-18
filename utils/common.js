const mongoose = require("mongoose");

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

// Validates the ID of documents
const validateObjectId = (id) => {
  if (!id) {
    return { valid: false, message: "ID is required." };
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { valid: false, message: "Invalid ID format." };
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

// Sets isActive to true
const setActiveStatusToFalse = async (Model, id) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.valid) return { success: false, message: idCheck.message };

  const modelCheck = validateModelExists(Model);
  if (!modelCheck.valid) return {success: false, message: modelCheck.message}

  const doc = await Model.findById(id);
  if (!doc) return { success: false, message: "Document not found." };

  doc.isActive = true;
  await doc.save({ validateBeforeSave: false });

  return { success: true, document: doc };
};

// Sets isActive to false
const setActiveStatusToTrue = async (Model, id) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.valid) return { success: false, message: idCheck.message };

  const doc = await Model.findById(id);
  if (!doc) return { success: false, message: "Document not found." };

  doc.isActive = false;
  if ("isDefault" in doc) doc.isDefault = false; 
  await doc.save({ validateBeforeSave: false });

  return { success: true, document: doc };
};

// Soft delete
const softDelete = async (Model, id) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.valid) return { success: false, message: idCheck.message };

  const doc = await Model.findById(id);
  if (!doc) return { success: false, message: "Document not found." };

  doc.isDeleted = true;
  if ("isDefault" in doc) doc.isDefault = false; 
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
const getAll = async (Model, filter = {}, vendorID) => {
    const idCheck = validateObjectId(id);
    if (!idCheck.valid) return { success: false, message: idCheck.message };

    const modelCheck = validateModelExists(Model);
    if (!modelCheck.valid) return {success: false, message: modelCheck.message}

    filter.vendorID = vendorID;
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

// Get default document
const getDefault = async (Model, vendorID) => {
  const doc = await Model.findOne({ vendorID, isDefault: true, isActive: true });
  if (!doc) return { success: false, message: "No default document found." };
  return { success: true, document: doc };
};

module.exports = {
  sendSuccess,
  sendError,
  validateObjectId,
  validateModelExists,
  setActiveStatusToFalse,
  setActiveStatusToTrue,
  softDelete,
  hardDelete,
  getAll,
  getByID,
  getDefault,
};

