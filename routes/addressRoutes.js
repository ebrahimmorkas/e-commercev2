const express = require("express");
const router = express.Router();

const addressController = require("../controllers/addressController");
const vendorDetection = require("../middlewares/vendorDetection");
const ensureVendorDataCached = require("../middlewares/ensureVendorDataCached");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const {
  createAddressSchema,
  updateAddressSchema,
  addressIdParamSchema,
} = require("../validators/address.validator");

// Every address route needs: which vendor storefront (domain) + that vendor's
// cached config (for allowedCountries) + which user is logged in.
router.use(vendorDetection, ensureVendorDataCached, authenticate);

router.post("/", validate(createAddressSchema, "body"), addressController.createAddress);

router.get("/", addressController.listAddresses);

router.get("/:id", validate(addressIdParamSchema, "params"), addressController.getAddressById);

router.put(
  "/:id",
  validate(addressIdParamSchema, "params"),
  validate(updateAddressSchema, "body"),
  addressController.updateAddress
);

router.delete("/:id", validate(addressIdParamSchema, "params"), addressController.deleteAddress);

module.exports = router;