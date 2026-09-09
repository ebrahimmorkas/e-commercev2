// Internal-only service - no controller/route exposes WeightMaster. Entries
// are managed directly in the DB (see seeds/seedWeightMaster.js), not
// through an API. Consumed by productService.js (weight-unit validation)
// and shippingPriceCalculationService.js (weight-based shipping unit conversion).
const WeightMaster = require('../models/WeightMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');

const WEIGHTS_CACHE_TTL = 3600;

const fetchAllWeights = async () => {
    try {
        logger.logInfo(null, null, 'Fetching all weights from DB');

        const fetchFromDB = async () => {
            const weights = await WeightMaster.find({ status: 'A' })
                .select('weightName weightShortName symbol type conversionFactor status')
                .lean();
            return weights;
        };

        const weightsData = await redisService.getOrSet(
            redisKeys.weights(),
            fetchFromDB,
            WEIGHTS_CACHE_TTL
        );

        return weightsData || [];
    } catch (err) {
        throw err;
    }
};

// Map of weightId (string) -> { type, conversionFactor } for O(1) lookups
// during shipping-weight calculation.
const fetchWeightMasterMap = async () => {
    try {
        const weights = await fetchAllWeights();
        return new Map(weights.map((w) => [w._id.toString(), { type: w.type, conversionFactor: w.conversionFactor }]));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchAllWeights,
    fetchWeightMasterMap
};
