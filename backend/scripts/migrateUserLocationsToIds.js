// One-time (safe to re-run) migration: converts customers' typed
// country/state/city names (e.g. "India", "Karnataka", "Bengaluru") into
// CountryMaster/StateMaster/CityMaster ids - the form User.country/state/city
// now holds (see services/userLocationService.js). The Country/State/City
// cookies (currency, tax, shipping) are only set for accounts in id form.
//
// Matching is by name or short name, case-insensitive: the state is looked up
// inside the matched country and the city inside the matched state. Users
// already holding ids are skipped. Anything that can't be matched is listed
// and left untouched, for you to fix (e.g. via admin Edit Customer).
//
// Run:  node scripts/migrateUserLocationsToIds.js           (dry run - changes nothing)
//       node scripts/migrateUserLocationsToIds.js --apply   (writes the ids)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');

const APPLY = process.argv.includes('--apply');

const normalize = (value) => (value || '').toString().trim().toLowerCase();
const isObjectId = (value) => !!value && mongoose.Types.ObjectId.isValid(value);

const findByName = (docs, value, nameField, shortField) => {
    try {
        const wanted = normalize(value);
        return docs.find((doc) => normalize(doc[nameField]) === wanted || normalize(doc[shortField]) === wanted) || null;
    } catch (err) {
        throw err;
    }
};

async function migrateUserLocationsToIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const [countries, states, cities] = await Promise.all([
            CountryMaster.find({ status: { $ne: 'D' } }).lean(),
            StateMaster.find({ status: { $ne: 'D' } }).lean(),
            CityMaster.find({ status: { $ne: 'D' } }).lean()
        ]);

        const users = await User.find({ status: { $ne: 'D' } }).select('vendorId username country state city').lean();
        let converted = 0;
        let alreadyIds = 0;
        const unmatched = [];

        for (const user of users) {
            if (isObjectId(user.country) && isObjectId(user.state) && isObjectId(user.city)) {
                alreadyIds++;
                continue;
            }

            const country = findByName(countries, user.country, 'country_name', 'short_country_name');
            const state = country
                ? findByName(states.filter((s) => s.country_id.toString() === country._id.toString()), user.state, 'state_name', 'short_state_name')
                : null;
            const city = state
                ? findByName(cities.filter((c) => c.state_id.toString() === state._id.toString()), user.city, 'city_name', 'short_city_name')
                : null;

            if (!country || !state || !city) {
                const missing = !country ? 'country' : !state ? 'state' : 'city';
                unmatched.push({ userId: user._id.toString(), username: user.username, country: user.country, state: user.state, city: user.city, missing });
                continue;
            }

            if (APPLY) {
                await User.updateOne(
                    { _id: user._id },
                    { $set: { country: country._id.toString(), state: state._id.toString(), city: city._id.toString() } }
                );
            }
            converted++;
            console.log(`${APPLY ? 'Converted' : 'Would convert'} ${user.username}: ${user.country} / ${user.state} / ${user.city}`);
        }

        console.log('');
        console.log(`${APPLY ? 'Converted' : 'Would convert'}: ${converted}`);
        console.log(`Already in id form: ${alreadyIds}`);
        console.log(`Could not match: ${unmatched.length}`);
        unmatched.forEach((u) => console.log(`  - ${u.username} (${u.userId}): ${u.country} / ${u.state} / ${u.city}  -> no matching ${u.missing}`));
        if (!APPLY) {
            console.log('\nDry run only - nothing was changed. Re-run with --apply to write the ids.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

migrateUserLocationsToIds();
