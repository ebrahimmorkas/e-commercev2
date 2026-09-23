const mongoose = require('mongoose');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const common = require('../utils/common');

const isObjectId = (value) => !!value && mongoose.Types.ObjectId.isValid(value);

/*
| A customer's country/state/city (User.country/state/city) is chosen from
| dropdowns of the vendor's allowed countries - at signup, and by the admin on
| Add User / Edit Customer - and stored as CountryMaster/StateMaster/CityMaster
| ids. It drives the Country/State/City cookies (currency, tax, shipping,
| location exclusions), so it must be a consistent, active chain the vendor
| serves.
*/
const validateUserLocation = async ({ countryId, stateId, cityId }, companyMasterData) => {
    try {
        if (!isObjectId(countryId) || !isObjectId(stateId) || !isObjectId(cityId)) {
            return common.returnResult(false, 400, 'Please select a valid country, state and city.');
        }

        const allowedCountryIds = (companyMasterData?.allowedCountries || []).map((id) => id.toString());
        if (!allowedCountryIds.includes(countryId.toString())) {
            return common.returnResult(false, 400, 'The selected country is not one this store serves.');
        }

        const country = await CountryMaster.findOne({ _id: countryId, status: 'A' }).select('_id').lean();
        if (!country) {
            return common.returnResult(false, 400, 'The selected country is not available.');
        }
        const state = await StateMaster.findOne({ _id: stateId, country_id: countryId, status: 'A' }).select('_id').lean();
        if (!state) {
            return common.returnResult(false, 400, 'The selected state does not belong to the selected country.');
        }
        const city = await CityMaster.findOne({ _id: cityId, state_id: stateId, status: 'A' }).select('_id').lean();
        if (!city) {
            return common.returnResult(false, 400, 'The selected city does not belong to the selected state.');
        }

        return common.returnResult(true, 200, 'All Good');
    } catch (err) {
        throw err;
    }
};

// The user's stored location, when it's in id form (a pre-migration account
// may still hold a typed name like "India" - then there is nothing to use).
const extractUserLocation = (user) => {
    try {
        return {
            countryId: isObjectId(user?.country) ? user.country.toString() : null,
            stateId: isObjectId(user?.state) ? user.state.toString() : null,
            cityId: isObjectId(user?.city) ? user.city.toString() : null
        };
    } catch (err) {
        throw err;
    }
};

module.exports = {
    validateUserLocation,
    extractUserLocation
};
