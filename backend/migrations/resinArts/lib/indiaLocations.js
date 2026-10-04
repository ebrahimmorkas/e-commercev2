// resinArts customers typed their state and city as free text. The new store
// keeps them as StateMaster / CityMaster ids, so the typed text has to be
// matched to one proper name first.

// Every Indian state and union territory, with its ISO 3166-2:IN code (the
// same codes the existing StateMaster rows use: MH, GJ, KA).
const INDIA_STATES = [
    { name: 'Andhra Pradesh', code: 'AP' },
    { name: 'Arunachal Pradesh', code: 'AR' },
    { name: 'Assam', code: 'AS' },
    { name: 'Bihar', code: 'BR' },
    { name: 'Chhattisgarh', code: 'CT' },
    { name: 'Goa', code: 'GA' },
    { name: 'Gujarat', code: 'GJ' },
    { name: 'Haryana', code: 'HR' },
    { name: 'Himachal Pradesh', code: 'HP' },
    { name: 'Jharkhand', code: 'JH' },
    { name: 'Karnataka', code: 'KA' },
    { name: 'Kerala', code: 'KL' },
    { name: 'Madhya Pradesh', code: 'MP' },
    { name: 'Maharashtra', code: 'MH' },
    { name: 'Manipur', code: 'MN' },
    { name: 'Meghalaya', code: 'ML' },
    { name: 'Mizoram', code: 'MZ' },
    { name: 'Nagaland', code: 'NL' },
    { name: 'Odisha', code: 'OR' },
    { name: 'Punjab', code: 'PB' },
    { name: 'Rajasthan', code: 'RJ' },
    { name: 'Sikkim', code: 'SK' },
    { name: 'Tamil Nadu', code: 'TN' },
    { name: 'Telangana', code: 'TG' },
    { name: 'Tripura', code: 'TR' },
    { name: 'Uttar Pradesh', code: 'UP' },
    { name: 'Uttarakhand', code: 'UT' },
    { name: 'West Bengal', code: 'WB' },
    { name: 'Andaman and Nicobar Islands', code: 'AN' },
    { name: 'Chandigarh', code: 'CH' },
    { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DH' },
    { name: 'Delhi', code: 'DL' },
    { name: 'Jammu and Kashmir', code: 'JK' },
    { name: 'Ladakh', code: 'LA' },
    { name: 'Lakshadweep', code: 'LD' },
    { name: 'Puducherry', code: 'PY' }
];

// Spellings actually found in the old data (and a few common ones) -> proper name.
const STATE_ALIASES = {
    'j&k': 'Jammu and Kashmir',
    'j & k': 'Jammu and Kashmir',
    'jammu & kashmir': 'Jammu and Kashmir',
    'jammu kashmir': 'Jammu and Kashmir',
    'gujrat': 'Gujarat',
    'maharasjtra': 'Maharashtra',
    'new delhi': 'Delhi',
    'orissa': 'Odisha',
    'pondicherry': 'Puducherry',
    'uttaranchal': 'Uttarakhand',
    'telengana': 'Telangana',
    'tamilnadu': 'Tamil Nadu'
};

// Old / alternative city names -> the name the CityMaster uses.
const CITY_ALIASES = {
    'bangalore': 'Bengaluru',
    'banglore': 'Bengaluru',
    'bombay': 'Mumbai',
    'mysore': 'Mysuru',
    'mangalore': 'Mangaluru',
    'baroda': 'Vadodara',
    'calcutta': 'Kolkata',
    'madras': 'Chennai',
    'gurgaon': 'Gurugram',
    'poona': 'Pune'
};

const normalize = (text) => {
    try {
        return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    } catch (err) {
        throw err;
    }
};

// Typed state text -> { name, code }, or null when it is empty or not a state
// this file knows.
const resolveState = (typedState) => {
    try {
        const key = normalize(typedState);
        if (!key) {
            return null;
        }
        const properName = normalize(STATE_ALIASES[key] || key);
        return INDIA_STATES.find(state => normalize(state.name) === properName) || null;
    } catch (err) {
        throw err;
    }
};

// Typed city text -> a tidy city name ("  mumbai " -> "Mumbai",
// "Bangalore" -> "Bengaluru"), or null when nothing was typed. There is no
// fixed list of cities, so a misspelt city comes through as typed.
const resolveCityName = (typedCity) => {
    try {
        const key = normalize(typedCity);
        if (!key) {
            return null;
        }
        if (CITY_ALIASES[key]) {
            return CITY_ALIASES[key];
        }
        return key.replace(/(^|[\s-])([a-z])/g, (match, separator, letter) => `${separator}${letter.toUpperCase()}`);
    } catch (err) {
        throw err;
    }
};

const escapeRegex = (text) => {
    try {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch (err) {
        throw err;
    }
};

// Case-insensitive exact match on a master's name field.
const exactNameQuery = (name) => {
    try {
        return { $regex: `^${escapeRegex(name)}$`, $options: 'i' };
    } catch (err) {
        throw err;
    }
};

module.exports = {
    resolveState,
    resolveCityName,
    exactNameQuery
};
