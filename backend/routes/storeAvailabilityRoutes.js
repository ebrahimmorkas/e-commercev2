const express = require('express');
const { getStoreAvailability } = require('../controllers/storeAvailabilityController');
const router = express.Router();

// Public, takes no input - and never refused by checkStoreAvailability (see
// STORE_STATUS_EXEMPT_PATHS).
router.get('/', getStoreAvailability);

module.exports = router;
