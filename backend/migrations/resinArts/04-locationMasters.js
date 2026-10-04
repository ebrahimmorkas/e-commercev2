// migrations/resinArts/04-locationMasters.js
//
// Step 4 - the states and cities the customers of step 5 live in.
//
// A new customer's state and city are StateMaster / CityMaster ids, not typed
// text. This adds whichever Indian states and cities the selected customers
// need and the masters do not have yet. Give it the SAME --limit / --ids as
// 05-users.js so it seeds exactly what that run will look up.
//
//   node migrations/resinArts/04-locationMasters.js --vendor localhost --limit 10            (dry run)
//   node migrations/resinArts/04-locationMasters.js --vendor localhost --limit 10 --apply
//
// Safe to re-run: a state or city is matched by name and only ever added.
// Review the cities it reports - a city is created exactly as the customer
// typed it (tidied to "Title Case"), so a misspelling becomes a city.

const CountryMaster = require('../../models/CountryMaster');
const StateMaster = require('../../models/StateMaster');
const CityMaster = require('../../models/CityMaster');
const redisKeys = require('../../utils/redisKeys');
const config = require('./config');
const { openContext, invalidateCache, run } = require('./lib/runtime');
const { readCollection } = require('./lib/backupReader');
const { createReport } = require('./lib/report');
const { selectCustomers } = require('./lib/customerSelection');
const { exactNameQuery } = require('./lib/indiaLocations');

// "Warangal" -> "WAR": the short name every existing city row carries.
const buildShortCityName = (cityName) => {
    try {
        return cityName.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
    } catch (err) {
        throw err;
    }
};

// The India row the vendor is allowed to sell to - customers can only be
// placed in a country on the vendor's plan (userLocationService).
const loadCountry = async (companyMasterData) => {
    try {
        const country = await CountryMaster.findOne({ short_country_name: config.COUNTRY_SHORT_NAME, status: 'A' }).lean();
        if (!country) {
            throw new Error(`CountryMaster has no active "${config.COUNTRY_SHORT_NAME}" country. Run seeds/seedCountryMaster.js first.`);
        }
        const isAllowed = (companyMasterData.allowedCountries || []).some(id => id.toString() === country._id.toString());
        if (!isAllowed) {
            throw new Error(`${country.country_name} is not in this vendor's allowed countries (CompanyMaster.allowedCountries).`);
        }
        return country;
    } catch (err) {
        throw err;
    }
};

const main = async () => {
    try {
        const ctx = await openContext('04-locationMasters');
        const { args, vendorId, adminId, companyMasterData } = ctx;
        const report = createReport('04-locationMasters', args.apply);

        const country = await loadCountry(companyMasterData);
        const { selected } = selectCustomers(readCollection(args.backupDir, 'users'), args);

        // Distinct states, and the distinct cities inside each, that the
        // selected customers need.
        const needed = new Map();
        for (const { mapped } of selected) {
            if (!needed.has(mapped.state.name)) {
                needed.set(mapped.state.name, { state: mapped.state, cityNames: new Set() });
            }
            if (mapped.cityName) {
                needed.get(mapped.state.name).cityNames.add(mapped.cityName);
            }
        }

        let hasCreatedAny = false;

        for (const { state, cityNames } of needed.values()) {
            let stateDoc = await StateMaster.findOne({ country_id: country._id, state_name: exactNameQuery(state.name), status: { $ne: 'D' } });

            if (stateDoc) {
                report.add('States', 'exists', state.name);
            } else if (args.apply) {
                stateDoc = await StateMaster.create({
                    country_id: country._id,
                    state_name: state.name,
                    short_state_name: state.code,
                    state_code: state.code,
                    status: 'A',
                    createdBy: adminId
                });
                hasCreatedAny = true;
                report.add('States', 'inserted', state.name, 'new state');
            } else {
                report.add('States', 'would-insert', state.name, 'new state');
            }

            for (const cityName of cityNames) {
                const label = `${cityName}, ${state.name}`;
                const cityDoc = stateDoc
                    ? await CityMaster.findOne({ state_id: stateDoc._id, city_name: exactNameQuery(cityName), status: { $ne: 'D' } })
                    : null;

                if (cityDoc) {
                    report.add('Cities', 'exists', label);
                } else if (args.apply) {
                    await CityMaster.create({
                        state_id: stateDoc._id,
                        city_name: cityName,
                        short_city_name: buildShortCityName(cityName),
                        status: 'A',
                        createdBy: adminId
                    });
                    hasCreatedAny = true;
                    report.add('Cities', 'inserted', label, 'new city - check the spelling');
                } else {
                    report.add('Cities', 'would-insert', label, 'new city - check the spelling');
                }
            }
        }

        if (hasCreatedAny) {
            await invalidateCache([redisKeys.states(vendorId), redisKeys.cities(vendorId), redisKeys.locationTaxBundle(vendorId)]);
        }

        report.print();
        report.save();
    } catch (err) {
        throw err;
    }
};

run(main);
