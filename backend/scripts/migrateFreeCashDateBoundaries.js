// One-time (safe to re-run) migration: moves existing Free Cash campaigns'
// startDate / endDate onto whole-day boundaries in the campaign's timezone -
// see utils/discountSchedule.js. Same fix as migrateDiscountDateBoundaries.js.
//
// Before this change the admin form's "YYYY-MM-DD" was saved as midnight UTC:
// a campaign "ending 30 Sep" in Asia/Kolkata actually stopped at 05:30 on
// 30 Sep. Every date still at exactly 00:00:00.000 UTC is rewritten to
// 00:00:00.000 (start) / 23:59:59.999 (end) of that calendar day in the
// campaign's timezone (Asia/Kolkata when it has none yet).
//
// Run:  node scripts/migrateFreeCashDateBoundaries.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const FreeCash = require('../models/FreeCash');
const {
    DEFAULT_DISCOUNT_TIMEZONE,
    isValidTimezone,
    startOfDayInZone,
    endOfDayInZone
} = require('../utils/discountSchedule');

const isUtcMidnight = (date) => {
    try {
        return date instanceof Date
            && date.getUTCHours() === 0 && date.getUTCMinutes() === 0
            && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
    } catch (err) {
        throw err;
    }
};

const utcDateKey = (date) => {
    try {
        return date.toISOString().slice(0, 10);
    } catch (err) {
        throw err;
    }
};

async function migrateFreeCashDateBoundaries() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const campaigns = await FreeCash.collection.find({}, { projection: { freeCashName: 1, startDate: 1, endDate: 1, timezone: 1 } }).toArray();

        let updated = 0;
        for (const campaign of campaigns) {
            const timezone = isValidTimezone(campaign.timezone) ? campaign.timezone : DEFAULT_DISCOUNT_TIMEZONE;
            const set = {};

            if (isUtcMidnight(campaign.startDate)) {
                const start = startOfDayInZone(utcDateKey(campaign.startDate), timezone);
                if (start.getTime() !== campaign.startDate.getTime()) set.startDate = start;
            }
            if (isUtcMidnight(campaign.endDate)) {
                set.endDate = endOfDayInZone(utcDateKey(campaign.endDate), timezone);
            }
            if (timezone !== campaign.timezone) set.timezone = timezone;

            if (Object.keys(set).length > 0) {
                await FreeCash.collection.updateOne({ _id: campaign._id }, { $set: set });
                updated += 1;
                console.log(`Updated "${campaign.freeCashName}" (${campaign._id}):`,
                    set.startDate ? `start ${campaign.startDate.toISOString()} -> ${set.startDate.toISOString()}` : '',
                    set.endDate ? `end ${campaign.endDate.toISOString()} -> ${set.endDate.toISOString()}` : '');
            }
        }

        console.log(`Checked ${campaigns.length} Free Cash campaign(s), updated ${updated}.`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error migrating Free Cash dates:', error);
        process.exit(1);
    }
}

migrateFreeCashDateBoundaries();
