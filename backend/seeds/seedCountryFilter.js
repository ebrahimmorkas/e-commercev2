// Lets the location seeds (country, state, city, tax, currency) be limited to
// part of the data:
//
//   SEED_COUNTRIES=AE                 only these countries (ISO 3166-1 alpha-2,
//                                     CountryMaster.short_country_name)
//   SEED_STATES=MH                    only these states (StateMaster.short_state_name)
//   SEED_CITIES=Mumbai,Pune,Nagpur    only these cities (CityMaster.city_name)
//
// Each is a comma separated list; one that is not set means "all of them".
// PowerShell: $env:SEED_COUNTRIES='IN'; $env:SEED_STATES='MH'; node seeds/seedStateMaster.js
const readList = (name) => {
    try {
        return (process.env[name] || '')
            .split(',')
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean);
    } catch (error) {
        throw error;
    }
};

const isListed = (name, value) => {
    try {
        const list = readList(name);
        return list.length === 0 || list.includes(String(value).trim().toUpperCase());
    } catch (error) {
        throw error;
    }
};

const isCountrySeeded = (countryShortName) => {
    try {
        return isListed('SEED_COUNTRIES', countryShortName);
    } catch (error) {
        throw error;
    }
};

const isStateSeeded = (stateShortName) => {
    try {
        return isListed('SEED_STATES', stateShortName);
    } catch (error) {
        throw error;
    }
};

const isCitySeeded = (cityName) => {
    try {
        return isListed('SEED_CITIES', cityName);
    } catch (error) {
        throw error;
    }
};

module.exports = { isCountrySeeded, isStateSeeded, isCitySeeded };
