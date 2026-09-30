// One-time (safe to re-run) migration: moves existing discounts' startDate /
// endDate onto whole-day boundaries in each discount's own timezone - see
// utils/discountSchedule.js.
//
// Before this change the admin form's "YYYY-MM-DD" was saved as-is, i.e. as
// midnight UTC: a discount "ending 2 Oct" in Asia/Kolkata actually ended at
// 05:30 on 2 Oct, and started at 05:30 on its first day. This rewrites every
// date still stored at exactly 00:00:00.000 UTC to 00:00:00.000 (start) /
// 23:59:59.999 (end) of that same calendar day in the discount's timezone.
// Dates already migrated (or saved by the new code) are never at 00:00 UTC
// unless the timezone is UTC itself, where the result is identical - so
// running it twice changes nothing.
//
// Run:  node scripts/migrateDiscountDateBoundaries.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Discount = require('../models/Discount');
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

// The calendar day the admin originally picked (the UTC date of a UTC-midnight value).
const utcDateKey = (date) => {
    try {
        return date.toISOString().slice(0, 10);
    } catch (err) {
        throw err;
    }
};

async function migrateDiscountDateBoundaries() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const discounts = await Discount.find(
            { isOngoingDiscount: { $ne: true }, $or: [{ startDate: { $ne: null } }, { endDate: { $ne: null } }] },
            { name: 1, vendorId: 1, startDate: 1, endDate: 1, timezone: 1 }
        ).lean();

        let updated = 0;
        for (const discount of discounts) {
            const timezone = isValidTimezone(discount.timezone) ? discount.timezone : DEFAULT_DISCOUNT_TIMEZONE;
            const set = {};

            if (isUtcMidnight(discount.startDate)) {
                const start = startOfDayInZone(utcDateKey(discount.startDate), timezone);
                if (start.getTime() !== discount.startDate.getTime()) set.startDate = start;
            }
            if (isUtcMidnight(discount.endDate)) {
                set.endDate = endOfDayInZone(utcDateKey(discount.endDate), timezone);
            }
            if (timezone !== discount.timezone) set.timezone = timezone;

            if (Object.keys(set).length > 0) {
                await Discount.updateOne({ _id: discount._id }, { $set: set });
                updated += 1;
                console.log(`Updated "${discount.name}" (${discount._id}):`,
                    set.startDate ? `start ${discount.startDate.toISOString()} -> ${set.startDate.toISOString()}` : '',
                    set.endDate ? `end ${discount.endDate.toISOString()} -> ${set.endDate.toISOString()}` : '');
            }
        }

        console.log(`Checked ${discounts.length} discount(s), updated ${updated}.`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error migrating discount dates:', error);
        process.exit(1);
    }
}

migrateDiscountDateBoundaries();
