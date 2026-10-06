// Lets the location seeds (country, state, city, tax, currency) be limited to
// some countries only:
//
//   SEED_COUNTRIES=AE node seeds/seedCountryMaster.js      (PowerShell: $env:SEED_COUNTRIES='AE')
//
// SEED_COUNTRIES is a comma separated list of ISO 3166-1 alpha-2 codes
// (CountryMaster.short_country_name). Not set = every country is seeded.
const getSeedCountries = () => {
    try {
        return (process.env.SEED_COUNTRIES || '')
            .split(',')
            .map((code) => code.trim().toUpperCase())
            .filter(Boolean);
    } catch (error) {
        throw error;
    }
};

const isCountrySeeded = (countryShortName) => {
    try {
        const seedCountries = getSeedCountries();
        return seedCountries.length === 0 || seedCountries.includes(String(countryShortName).toUpperCase());
    } catch (error) {
        throw error;
    }
};

module.exports = { isCountrySeeded };
