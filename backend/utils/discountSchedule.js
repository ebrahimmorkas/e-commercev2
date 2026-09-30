/*
|--------------------------------------------------------------------------
| DISCOUNT SCHEDULE (timezone-aware dates, days and hours)
|--------------------------------------------------------------------------
| Every discount carries its own IANA `timezone`, and all of its calendar
| rules are read in that zone:
|   - startDate / endDate are whole days: the admin picks "1 Oct - 2 Oct"
|     and the discount runs from 00:00:00.000 on 1 Oct to 23:59:59.999 on
|     2 Oct in the discount's timezone (stored as the matching UTC instants).
|   - specificDays / specificHours are the local weekday and "HH:mm" time.
|     The hours window is start-inclusive, end-exclusive (10:00-18:00 ends at
|     17:59:59). An end before the start is an overnight window (22:00-02:00):
|     the part after midnight belongs to the day it started on, so a
|     "Friday 22:00-02:00" discount is open until Saturday 01:59.
*/

const DEFAULT_DISCOUNT_TIMEZONE = 'Asia/Kolkata';
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEK_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const isValidTimezone = (timezone) => {
    try {
        if (typeof timezone !== 'string' || !timezone.trim()) return false;
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return true;
    } catch (err) {
        return false;
    }
};

// The wall-clock fields of `date` in `timezone`.
const getZonedParts = (date, timezone) => {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            weekday: 'long'
        }).formatToParts(date);
        const get = (type) => parts.find((p) => p.type === type).value;
        return {
            year: Number(get('year')),
            month: Number(get('month')),
            day: Number(get('day')),
            hour: Number(get('hour')),
            minute: Number(get('minute')),
            second: Number(get('second')),
            weekday: get('weekday').toUpperCase()
        };
    } catch (err) {
        throw err;
    }
};

// How far `timezone` is ahead of UTC at the instant `date`, in ms.
const getTimezoneOffsetMs = (date, timezone) => {
    try {
        const p = getZonedParts(date, timezone);
        const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
        return asUtc - Math.floor(date.getTime() / 1000) * 1000;
    } catch (err) {
        throw err;
    }
};

// "YYYY-MM-DD" of `date` as a calendar day in `timezone`.
const toDateKey = (date, timezone) => {
    try {
        const p = getZonedParts(new Date(date), timezone);
        return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    } catch (err) {
        throw err;
    }
};

// A "YYYY-MM-DD" string as-is, anything else (Date / ISO string) as its
// calendar day in `timezone`. Null when it isn't a date at all.
const normalizeDateKey = (value, timezone) => {
    try {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) return value;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return toDateKey(date, timezone);
    } catch (err) {
        throw err;
    }
};

// The UTC instant of 00:00:00.000 ('start') or 23:59:59.999 ('end') on the
// given calendar day in `timezone`.
const zonedDayBoundary = (value, timezone, boundary) => {
    try {
        const dateKey = normalizeDateKey(value, timezone);
        if (!dateKey) return null;
        const [, y, m, d] = dateKey.match(DATE_ONLY_PATTERN).map(Number);
        const wallClock = boundary === 'end'
            ? Date.UTC(y, m - 1, d, 23, 59, 59, 999)
            : Date.UTC(y, m - 1, d, 0, 0, 0, 0);
        // Offset at the guess, then again at the result - correct across a DST change.
        let instant = wallClock - getTimezoneOffsetMs(new Date(wallClock), timezone);
        instant = wallClock - getTimezoneOffsetMs(new Date(instant), timezone);
        return new Date(instant);
    } catch (err) {
        throw err;
    }
};

const startOfDayInZone = (value, timezone) => {
    try {
        return zonedDayBoundary(value, timezone, 'start');
    } catch (err) {
        throw err;
    }
};

const endOfDayInZone = (value, timezone) => {
    try {
        return zonedDayBoundary(value, timezone, 'end');
    } catch (err) {
        throw err;
    }
};

// True when the calendar day `value` is before today in `timezone`.
const isDateBeforeToday = (value, timezone, now = new Date()) => {
    try {
        const dateKey = normalizeDateKey(value, timezone);
        return dateKey !== null && dateKey < toDateKey(now, timezone);
    } catch (err) {
        throw err;
    }
};

const timeToMinutes = (time) => {
    try {
        const match = TIME_PATTERN.exec(String(time || ''));
        return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    } catch (err) {
        throw err;
    }
};

const previousWeekDay = (weekday) => {
    try {
        return WEEK_DAYS[(WEEK_DAYS.indexOf(weekday) + 6) % 7];
    } catch (err) {
        throw err;
    }
};

const toTitleCase = (day) => {
    try {
        return day.charAt(0) + day.slice(1).toLowerCase();
    } catch (err) {
        throw err;
    }
};

/**
 * Is the discount's specific-days (+hours) window open at `now`?
 * @returns {{ open: boolean, reason?: string }}
 */
const checkDaysAndHoursWindow = (discount, now = new Date()) => {
    try {
        if (!discount.isDiscountOpenForSpecificDays) return { open: true };

        const timezone = isValidTimezone(discount.timezone) ? discount.timezone : DEFAULT_DISCOUNT_TIMEZONE;
        const days = discount.specificDays || [];
        const local = getZonedParts(now, timezone);
        const dayList = WEEK_DAYS.filter((d) => days.includes(d)).map(toTitleCase).join(', ');

        if (!discount.isDiscountOpenForSpecificHours) {
            return days.includes(local.weekday)
                ? { open: true }
                : { open: false, reason: `This discount is only available on ${dayList}.` };
        }

        const start = timeToMinutes(discount.specificHoursStartTime);
        const end = timeToMinutes(discount.specificHoursEndTime);
        const current = local.hour * 60 + local.minute;
        const hoursText = `${discount.specificHoursStartTime} to ${discount.specificHoursEndTime}`;
        const closed = { open: false, reason: `This discount is only available on ${dayList}, from ${hoursText}.` };
        if (start === null || end === null || start === end) return closed;

        if (start < end) {
            return days.includes(local.weekday) && current >= start && current < end ? { open: true } : closed;
        }
        // Overnight: the evening part belongs to today, the after-midnight part to yesterday.
        if (current >= start && days.includes(local.weekday)) return { open: true };
        if (current < end && days.includes(previousWeekDay(local.weekday))) return { open: true };
        return closed;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    DEFAULT_DISCOUNT_TIMEZONE,
    DATE_ONLY_PATTERN,
    TIME_PATTERN,
    isValidTimezone,
    toDateKey,
    normalizeDateKey,
    startOfDayInZone,
    endOfDayInZone,
    isDateBeforeToday,
    timeToMinutes,
    checkDaysAndHoursWindow
};
