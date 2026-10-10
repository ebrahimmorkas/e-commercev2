// migrations/resinArts/05-users.js
//
// Step 5 - customers and their address. Run 04-locationMasters first, with
// the same --limit / --ids.
//
// User (the old _id is kept, so favourites keep pointing at their customer):
//   first_name + middle_name + last_name   -> name
//   email                                  -> email, and username (the old store had no usernames)
//   phone_number / whatsapp_number         -> phone_no / whatsapp_no
//   password                               copied - it is a bcrypt hash the new login accepts,
//                                          so customers keep their password
//   state / city (typed text)              -> StateMaster / CityMaster ids; country is always India.
//                                          No state -> config.DEFAULT_STATE_NAME. A city that is
//                                          not in the CityMaster is left empty when the vendor has
//                                          Make City Optional on (and is listed in the report)
//   favorites                              -> step 6
//   resetPasswordToken / resetPasswordExpires   dropped
//
// Address (the old store kept one free-text address and a zip code per customer):
//   address   -> address_in_words        zip_code -> pincode
//   address_name, room_no, building      fixed values from config.js - the old data has none
//   country / state / city               the same ids as the customer; it is their default address
//
// Not migrated, and listed in the report: the admin account, and any customer
// whose name, email, phone, WhatsApp number or location fails the new store's
// rules. A customer whose old address is missing or invalid is still migrated,
// without an address, and is listed too.
//
//   node migrations/resinArts/05-users.js --vendor localhost --limit 10            (dry run)
//   node migrations/resinArts/05-users.js --vendor localhost --limit 10 --apply
//
// Safe to re-run: a customer or address that is already there is left alone
// (--overwrite replaces it - including a password the customer changed since).

const User = require('../../models/User');
const Address = require('../../models/Address');
const CountryMaster = require('../../models/CountryMaster');
const StateMaster = require('../../models/StateMaster');
const CityMaster = require('../../models/CityMaster');
const userLocationService = require('../../services/userLocationService');
const { createAddressSchema } = require('../../middlewares/validations/addressValidations');
const config = require('./config');
const { openContext, run } = require('./lib/runtime');
const { readCollection } = require('./lib/backupReader');
const { createReport } = require('./lib/report');
const { selectCustomers, describeCustomer } = require('./lib/customerSelection');
const { exactNameQuery } = require('./lib/indiaLocations');
const { deterministicObjectId, saveDocument, describeValidationError } = require('./lib/helpers');

const USERS = 'Users';
const ADDRESSES = 'Addresses';
const CITIES = 'Cities left empty';

// Typed state/city -> master ids, checked with the same service the signup
// and Add Customer endpoints use (country on the vendor's plan, state inside
// the country, city inside the state, city optional only if the vendor says so).
// Returns { countryId, stateId, cityId, droppedCityName } or { skipReason }.
const resolveLocation = async (mapped, country, ctx, cache) => {
    try {
        const cacheKey = `${mapped.state.name}|${mapped.cityName || ''}`;
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        const isCityOptional = userLocationService.isCityOptionalForVendor(ctx.companySettingsData);
        let resolved;

        const state = await StateMaster.findOne({ country_id: country._id, state_name: exactNameQuery(mapped.state.name), status: 'A' }).select('_id').lean();
        if (!state) {
            resolved = { skipReason: `state "${mapped.state.name}" is not in the StateMaster - run 04-locationMasters.js with the same options first` };
        } else {
            const city = mapped.cityName
                ? await CityMaster.findOne({ state_id: state._id, city_name: exactNameQuery(mapped.cityName), status: 'A' }).select('_id').lean()
                : null;

            if (mapped.cityName && !city && !isCityOptional) {
                resolved = { skipReason: `city "${mapped.cityName}" is not in the CityMaster - run 04-locationMasters.js with the same options first` };
            } else if (!city && !isCityOptional) {
                resolved = { skipReason: 'no city in the old data, and this vendor requires a city (Company Settings > Make City Optional is off)' };
            } else {
                const location = {
                    countryId: country._id,
                    stateId: state._id,
                    cityId: city ? city._id : null,
                    droppedCityName: mapped.cityName && !city ? mapped.cityName : null
                };
                const check = await userLocationService.validateUserLocation(
                    { countryId: location.countryId, stateId: location.stateId, cityId: location.cityId },
                    ctx.companyMasterData,
                    isCityOptional
                );
                resolved = check.isSuccess ? location : { skipReason: check.message };
            }
        }

        cache.set(cacheKey, resolved);
        return resolved;
    } catch (err) {
        throw err;
    }
};

const buildUser = (source, mapped, location, ctx) => {
    try {
        const createdAt = source._id.getTimestamp();

        return new User({
            _id: source._id,
            vendorId: ctx.vendorId,
            name: mapped.name,
            username: mapped.email,
            email: mapped.email,
            password: source.password,
            authProvider: 'local',
            phone_no: mapped.phone_no,
            whatsapp_no: mapped.whatsapp_no,
            role: 'user',
            country: location.countryId.toString(),
            state: location.stateId.toString(),
            city: location.cityId ? location.cityId.toString() : undefined,
            status: 'A',
            createdBy: ctx.adminId,
            createdAt,
            updatedAt: createdAt
        });
    } catch (err) {
        throw err;
    }
};

// Returns { address } or { skipReason } - checked against the same Joi schema
// the Add Address endpoint uses.
const buildAddress = (source, location, ctx) => {
    try {
        const fields = {
            address_name: config.ADDRESS_NAME,
            room_no: config.ADDRESS_ROOM_NO_PLACEHOLDER,
            building: config.ADDRESS_BUILDING_PLACEHOLDER,
            address_in_words: String(source.address || '').trim(),
            country_id: location.countryId.toString(),
            state_id: location.stateId.toString(),
            city_id: location.cityId ? location.cityId.toString() : null,
            pincode: String(source.zip_code || '').trim(),
            isDefault: true
        };

        if (!fields.address_in_words) {
            return { skipReason: 'no address in the old data' };
        }
        const { error } = createAddressSchema.validate(fields, { abortEarly: false });
        if (error) {
            return { skipReason: error.details.map(detail => detail.message.replace(/"/g, '')).join('; ') };
        }

        const createdAt = source._id.getTimestamp();
        const address = new Address({
            ...fields,
            _id: deterministicObjectId('address', source._id),
            userId: source._id,
            vendorId: ctx.vendorId,
            status: 'A',
            createdBy: source._id,
            createdAt,
            updatedAt: createdAt
        });

        return { address };
    } catch (err) {
        throw err;
    }
};

// A dry run cannot hit the unique indexes, so look for the clash up front:
// another account of this vendor already using the email, phone or WhatsApp number.
const findClash = async (source, mapped, vendorId) => {
    try {
        const conditions = [{ username: mapped.email }, { email: mapped.email }, { phone_no: mapped.phone_no }];
        if (mapped.whatsapp_no) conditions.push({ whatsapp_no: mapped.whatsapp_no });

        const other = await User.findOne({ vendorId, _id: { $ne: source._id }, $or: conditions }).select('email phone_no whatsapp_no').lean();
        if (!other) {
            return null;
        }
        if (other.email === mapped.email) return 'email';
        if (other.phone_no === mapped.phone_no) return 'phone number';
        return 'WhatsApp number';
    } catch (err) {
        throw err;
    }
};

const main = async () => {
    try {
        const ctx = await openContext('05-users');
        const { args, vendorId } = ctx;
        const report = createReport('05-users', args.apply);
        const saveOptions = { apply: args.apply, overwrite: args.overwrite, vendorId };

        await User.init();
        await Address.init();

        const country = await CountryMaster.findOne({ short_country_name: config.COUNTRY_SHORT_NAME, status: 'A' }).lean();
        if (!country) {
            throw new Error(`CountryMaster has no active "${config.COUNTRY_SHORT_NAME}" country. Run seeds/seedCountryMaster.js first.`);
        }

        const { selected, rejected } = selectCustomers(readCollection(args.backupDir, 'users'), args);
        const locationCache = new Map();

        for (const { source, mapped, reason } of rejected) {
            report.add(USERS, 'skipped', describeCustomer(source, mapped), reason);
        }

        for (const { source, mapped } of selected) {
            const label = describeCustomer(source, mapped);

            try {
                const location = await resolveLocation(mapped, country, ctx, locationCache);
                if (location.skipReason) {
                    report.add(USERS, 'skipped', label, location.skipReason);
                    continue;
                }

                const clash = await findClash(source, mapped, vendorId);
                if (clash) {
                    report.add(USERS, 'duplicate', label, `the new store already has another account with this ${clash}`);
                    continue;
                }

                const userResult = await saveDocument(User, buildUser(source, mapped, location, ctx), saveOptions);
                report.add(USERS, userResult.outcome, label, userResult.reason);
                if (userResult.outcome === 'duplicate' || userResult.outcome === 'conflict') {
                    continue;
                }
                if (location.droppedCityName) {
                    report.add(CITIES, 'skipped', label, `customer migrated WITHOUT a city: "${location.droppedCityName}" is not in the CityMaster`);
                }

                const builtAddress = buildAddress(source, location, ctx);
                if (builtAddress.skipReason) {
                    report.add(ADDRESSES, 'skipped', label, `customer migrated WITHOUT an address: ${builtAddress.skipReason}`);
                    continue;
                }
                const addressResult = await saveDocument(Address, builtAddress.address, saveOptions);
                report.add(ADDRESSES, addressResult.outcome, label, addressResult.reason);
            } catch (err) {
                const validationMessage = describeValidationError(err);
                if (!validationMessage) throw err;
                report.add(USERS, 'skipped', label, `fails the new store's model: ${validationMessage}`);
            }
        }

        report.print();
        report.save();
    } catch (err) {
        throw err;
    }
};

run(main);
