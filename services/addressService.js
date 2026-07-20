const Address = require("../models/Address");
const CountryMaster = require("../models/CountryMaster");
const StateMaster = require("../models/StateMaster");
const CityMaster = require("../models/CityMaster");

const fail = (statusCode, message) => ({ error: true, statusCode, message });
const ok = (data) => ({ error: false, data });

const isAllowedCountry = (countryId, allowedCountries = []) => {
  return allowedCountries.some((id) => id.toString() === countryId.toString());
};

/**
 * Confirms country/state/city all exist and are active, AND that the state actually
 * belongs to the given country, and the city actually belongs to the given state.
 * Returns a `fail(...)` object if anything is wrong, or null if everything checks out.
 */
const validateLocationHierarchy = async ({ country_id, state_id, city_id }) => {
  const [country, state, city] = await Promise.all([
    CountryMaster.findOne({ _id: country_id, status: "A" }),
    StateMaster.findOne({ _id: state_id, status: "A" }),
    CityMaster.findOne({ _id: city_id, status: "A" }),
  ]);

  if (!country) return fail(400, "Invalid or inactive country");
  if (!state) return fail(400, "Invalid or inactive state");
  if (!city) return fail(400, "Invalid or inactive city");

  if (state.country_id.toString() !== country_id.toString()) {
    return fail(400, "Selected state does not belong to the selected country");
  }

  if (city.state_id.toString() !== state_id.toString()) {
    return fail(400, "Selected city does not belong to the selected state");
  }

  return null;
};

/**
 * Creates a new address for the logged-in user, under the current vendor.
 */
const createAddress = async (payload, context) => {
  try {
    const { userId, vendorId, allowedCountries } = context;
    const { country_id, state_id, city_id } = payload;

    if (!isAllowedCountry(country_id, allowedCountries)) {
      return fail(400, "Selected country is not serviceable for this store");
    }

    const hierarchyError = await validateLocationHierarchy({ country_id, state_id, city_id });
    if (hierarchyError) return hierarchyError;

    const address = await Address.create({
      ...payload,
      user_id: userId,
      vendor_id: vendorId,
      createdBy: userId,
    });

    return ok(address);
  } catch (err) {
    throw err;
  }
};

/**
 * Lists all active (non-deleted) addresses belonging to this user under this vendor.
 */
const listAddresses = async ({ userId, vendorId }) => {
  try {
    const addresses = await Address.find({
      user_id: userId,
      vendor_id: vendorId,
      status: { $ne: "D" },
    })
      .populate("country_id", "country_name")
      .populate("state_id", "state_name")
      .populate("city_id", "city_name")
      .sort({ createdAt: -1 });

    return ok(addresses);
  } catch (err) {
    throw err;
  }
};

/**
 * Fetches a single address - scoped to the owning user + vendor so one user
 * can never fetch another user's (or another vendor's) address by guessing an id.
 */
const getAddressById = async (addressId, { userId, vendorId }) => {
  try {
    const address = await Address.findOne({
      _id: addressId,
      user_id: userId,
      vendor_id: vendorId,
      status: { $ne: "D" },
    })
      .populate("country_id", "country_name")
      .populate("state_id", "state_name")
      .populate("city_id", "city_name");

    if (!address) {
      return fail(404, "Address not found");
    }

    return ok(address);
  } catch (err) {
    throw err;
  }
};

/**
 * Updates an address. Only re-validates the location hierarchy if the caller is
 * actually changing country/state/city - no need to re-check untouched addresses.
 */
const updateAddress = async (addressId, payload, context) => {
  try {
    const { userId, vendorId, allowedCountries } = context;

    const address = await Address.findOne({
      _id: addressId,
      user_id: userId,
      vendor_id: vendorId,
      status: { $ne: "D" },
    });

    if (!address) {
      return fail(404, "Address not found");
    }

    const isChangingLocation = payload.country_id || payload.state_id || payload.city_id;

    if (isChangingLocation) {
      const country_id = payload.country_id || address.country_id;
      const state_id = payload.state_id || address.state_id;
      const city_id = payload.city_id || address.city_id;

      if (payload.country_id && !isAllowedCountry(payload.country_id, allowedCountries)) {
        return fail(400, "Selected country is not serviceable for this store");
      }

      const hierarchyError = await validateLocationHierarchy({ country_id, state_id, city_id });
      if (hierarchyError) return hierarchyError;
    }

    Object.assign(address, payload, { updatedBy: userId });
    await address.save();

    return ok(address);
  } catch (err) {
    throw err;
  }
};

/**
 * Soft-deletes an address (status -> 'D'), matching the pattern used across
 * your other master collections instead of a hard delete.
 */
const deleteAddress = async (addressId, { userId, vendorId }) => {
  try {
    const address = await Address.findOne({
      _id: addressId,
      user_id: userId,
      vendor_id: vendorId,
      status: { $ne: "D" },
    });

    if (!address) {
      return fail(404, "Address not found");
    }

    address.status = "D";
    address.deletedBy = userId;
    await address.save();

    return ok(true);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  createAddress,
  listAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
};