require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Vendor = require('../models/Vendor');
const User = require('../models/User');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');

// The store's admin account. Run after seedVendor and after the location
// seeds (seedCountryMaster -> seedStateMaster -> seedCityMaster): a user's
// country / state / city are stored as the ids of those master rows.
//
// The password is NOT written in this file - it is read from
// SEED_ADMIN_PASSWORD in .env (which is never committed), so it stays out of
// the repository:
//   SEED_ADMIN_PASSWORD=<the admin's password>
// Remove that line from .env once the admin has been created.
//
// The admin can log in with the username, the email or the phone number.
//
// Safe to re-run: the admin is matched by vendor + email. An admin that
// already exists is left exactly as it is (its password included) - this
// script never resets a password. To change one, use the app.
const VENDOR_DOMAIN = 'mouldmarket.in';

const ADMIN = {
    name: 'Ebrahim Kanchwala',
    username: 'ebrubhai@hotmail.com',
    email: 'ebrubhai@hotmail.com',
    phone_no: '9987003587',
    whatsapp_no: '9987003587'
};

// The admin's own location (CountryMaster.short_country_name,
// StateMaster.short_state_name, CityMaster.city_name).
const ADMIN_LOCATION = { country: 'IN', state: 'MH', city: 'Mumbai' };

async function seedUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: VENDOR_DOMAIN });
        if (!vendor) {
            throw new Error(`Vendor ${VENDOR_DOMAIN} not found. Please run seedVendor first.`);
        }

        const existingAdmin = await User.findOne({ vendorId: vendor._id, email: ADMIN.email, status: { $ne: 'D' } });
        if (existingAdmin) {
            process.stdout.write(`Admin ${ADMIN.email} already exists for ${VENDOR_DOMAIN} - left unchanged.\n`);
            await mongoose.connection.close();
            process.exit(0);
        }

        const password = process.env.SEED_ADMIN_PASSWORD;
        if (!password || password.length < 8) {
            throw new Error('Set SEED_ADMIN_PASSWORD (at least 8 characters) in .env before running this seed.');
        }

        const country = await CountryMaster.findOne({ short_country_name: ADMIN_LOCATION.country, status: 'A' });
        if (!country) {
            throw new Error(`Country ${ADMIN_LOCATION.country} not found. Please run seedCountryMaster first.`);
        }
        const state = await StateMaster.findOne({ country_id: country._id, short_state_name: ADMIN_LOCATION.state, status: 'A' });
        if (!state) {
            throw new Error(`State ${ADMIN_LOCATION.state} not found. Please run seedStateMaster first.`);
        }
        const city = await CityMaster.findOne({ state_id: state._id, city_name: ADMIN_LOCATION.city, status: 'A' });
        if (!city) {
            throw new Error(`City ${ADMIN_LOCATION.city} not found. Please run seedCityMaster first.`);
        }

        const hashedPassword = await bcrypt.hash(password, Number(process.env.SALT_ROUNDS) || 10);

        await User.create({
            ...ADMIN,
            country: country._id.toString(),
            state: state._id.toString(),
            city: city._id.toString(),
            vendorId: vendor._id,
            password: hashedPassword,
            authProvider: 'local',
            googleId: null,
            role: 'admin',
            status: 'A'
        });

        process.stdout.write(`Admin ${ADMIN.email} created for ${VENDOR_DOMAIN}.\n`);
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`seedUser failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedUser();
