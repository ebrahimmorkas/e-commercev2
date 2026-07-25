const addressService = require("../services/addressService");
const { sendSuccess, sendError } = require("../utils/common");
const { logInfo, logException } = require("../utils/logger");

const createAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const vendorId = req.vendorId;
    const allowedCountries = req.companyMasterData?.allowedCountries || [];

    const result = await addressService.createAddress(req.body, { userId, vendorId, allowedCountries });

    if (!result.isSuccess) {
      logInfo(0, 1, "Create address failed", { userId, reason: result.message });
      return sendError(res, result.statusCode, result.message);
    }

    logInfo(1, 0, "Address created successfully", { userId, addressId: result.data._id });
    return sendSuccess(res, 201, result.message);;
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

    logInfo(1, 0, "Addresses fetched successfully", { userId, count: result.data.length });
    return sendSuccess(res, 200, result.message, result.meta);
  } catch (err) {
    logException("Error while fetching addresses", err);
  }
};

const getAddressById = async (req, res) => {
  try {
    const userId = req.user._id;
    const vendorId = req.vendorId;
    const { id } = req.params;

    const result = await addressService.getAddressById(id, { userId, vendorId });

    if (!result.isSuccess) {
      logInfo(0, 1, "Get address failed", { userId, addressId: id, reason: result.message });
      return sendError(res, result.statusCode, result.message);
    }

    logInfo(1, 0, "Address fetched successfully", { userId, addressId: id });
    return sendSuccess(res, 200, result.message, result.meta);
  } catch (err) {
    logException("Error while fetching address", err);
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const vendorId = req.vendorId;
    const allowedCountries = req.companyMasterData?.allowedCountries || [];
    const { id } = req.params;

    const result = await addressService.updateAddress(id, req.body, { userId, vendorId, allowedCountries });

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
  try {
    const userId = req.user._id;
    const vendorId = req.vendorId;
    const { id } = req.params;

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