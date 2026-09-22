const addressService = require("../services/addressService");
const { sendSuccess, sendError, encodeId, decodeId } = require("../utils/common");
const { logInfo, logException } = require("../utils/logger");

// A populated ref field (country_id/state_id/city_id via addressService's
// .populate() calls) comes back as { _id, ...projectedFields } instead of a
// bare ObjectId - encode its _id too, not just bare-id fields.
const encodeRefField = (value) => {
  if (!value) return value;
  if (typeof value === "object" && value._id) {
    return { ...value, _id: encodeId(value._id) };
  }
  return encodeId(value);
};

// Converts an Address mongoose doc into a response-safe object with every
// ObjectId field encoded via common.encodeId.
const formatAddressForResponse = (addressDoc) => {
  if (!addressDoc) return addressDoc;
  const address = addressDoc.toObject ? addressDoc.toObject() : addressDoc;

  return {
    ...address,
    _id: address._id ? encodeId(address._id) : address._id,
    vendorId: address.vendorId ? encodeId(address.vendorId) : address.vendorId,
    userId: address.userId ? encodeId(address.userId) : address.userId,
    country_id: encodeRefField(address.country_id),
    state_id: encodeRefField(address.state_id),
    city_id: encodeRefField(address.city_id),
    createdBy: address.createdBy ? encodeId(address.createdBy) : address.createdBy,
    updatedBy: address.updatedBy ? encodeId(address.updatedBy) : address.updatedBy,
    deletedBy: address.deletedBy ? encodeId(address.deletedBy) : address.deletedBy,
    activeMarkedBy: address.activeMarkedBy ? encodeId(address.activeMarkedBy) : address.activeMarkedBy,
    inActiveMarkedBy: address.inActiveMarkedBy ? encodeId(address.inActiveMarkedBy) : address.inActiveMarkedBy,
  };
};

// Decodes the location-picker fields of an incoming payload, when present -
// createAddress requires them, updateAddress only sends the ones changing.
const decodeLocationFields = (payload) => {
  const decoded = { ...payload };
  if (decoded.country_id) decoded.country_id = decodeId(decoded.country_id);
  if (decoded.state_id) decoded.state_id = decodeId(decoded.state_id);
  if (decoded.city_id) decoded.city_id = decodeId(decoded.city_id);
  return decoded;
};

const createAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const vendorId = req.vendorId;
    const allowedCountries = req.companyMasterData?.allowedCountries || [];

    const payload = decodeLocationFields(req.body);
    const result = await addressService.createAddress(payload, { userId, vendorId, allowedCountries });

    if (!result.isSuccess) {
      logInfo(0, 1, "Create address failed", { userId, reason: result.message });
      return sendError(res, result.statusCode, result.message);
    }

    logInfo(1, 0, "Address created successfully", { userId, addressId: result.meta.address._id });
    return sendSuccess(res, 201, result.message, { address: formatAddressForResponse(result.meta.address) });
  } catch (err) {
    logException("Error while creating address", err);
  }
};

const listAddresses = async (req, res) => {
  try {
    const userId = req.user._id;
    const vendorId = req.vendorId;

    const result = await addressService.listAddresses({ userId, vendorId });

    if (!result.isSuccess) {
      logInfo(0, 1, "List addresses failed", { userId, reason: result.message });
      return sendError(res, result.statusCode, result.message);
    }

    logInfo(1, 0, "Addresses fetched successfully", { userId, count: result.meta.addresses.length });
    return sendSuccess(res, 200, result.message, { addresses: result.meta.addresses.map(formatAddressForResponse) });
  } catch (err) {
    logException("Error while fetching addresses", err);
  }
};

const getAddressById = async (req, res) => {
  const userId = req.user._id;
  const vendorId = req.vendorId;
  let id;
  try {
    id = decodeId(req.params.id);

    const result = await addressService.getAddressById(id, { userId, vendorId });

    if (!result.isSuccess) {
      logInfo(0, 1, "Get address failed", { userId, addressId: id, reason: result.message });
      return sendError(res, result.statusCode, result.message);
    }

    logInfo(1, 0, "Address fetched successfully", { userId, addressId: id });
    return sendSuccess(res, 200, result.message, { address: formatAddressForResponse(result.meta.address) });
  } catch (err) {
    logException("Error while fetching address", err);
  }
};

const updateAddress = async (req, res) => {
  const userId = req.user._id;
  const vendorId = req.vendorId;
  let id;
  try {
    const allowedCountries = req.companyMasterData?.allowedCountries || [];
    id = decodeId(req.params.id);
    const payload = decodeLocationFields(req.body);

    const result = await addressService.updateAddress(id, payload, { userId, vendorId, allowedCountries });

    if (!result.isSuccess) {
      logInfo(0, 1, "Update address failed", { userId, addressId: id, reason: result.message });
      return sendError(res, result.statusCode, result.message);
    }

    logInfo(1, 0, "Address updated successfully", { userId, addressId: id });
    return sendSuccess(res, 200, result.message);
  } catch (err) {
    logException("Error while updating address", err);
  }
};

const deleteAddress = async (req, res) => {
  const userId = req.user._id;
  const vendorId = req.vendorId;
  let id;
  try {
    id = decodeId(req.params.id);

    const result = await addressService.deleteAddress(id, { userId, vendorId });

    if (!result.isSuccess) {
      logInfo(0, 1, "Delete address failed", { userId, addressId: id, reason: result.message });
      return sendError(res, result.statusCode, result.message);
    }

    logInfo(1, 0, "Address deleted successfully", { userId, addressId: id });
    return sendSuccess(res, 200, result.message);
  } catch (err) {
    logException("Error while deleting address", err);
  }
};

module.exports = {
  createAddress,
  listAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
};
