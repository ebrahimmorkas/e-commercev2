const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isValidTimezone,
    toDateKey,
    normalizeDateKey,
    startOfDayInZone,
    endOfDayInZone,
    isDateBeforeToday,
    timeToMinutes,
    checkDaysAndHoursWindow
} = require('../utils/discountSchedule');

const iso = (date) => date.toISOString();

test('whole-day boundaries in Asia/Kolkata (UTC+5:30)', () => {
    assert.equal(iso(startOfDayInZone('2026-10-01', 'Asia/Kolkata')), '2026-09-30T18:30:00.000Z');
    assert.equal(iso(endOfDayInZone('2026-10-02', 'Asia/Kolkata')), '2026-10-02T18:29:59.999Z');
});

test('whole-day boundaries in UTC and in a +5:45 zone', () => {
    assert.equal(iso(startOfDayInZone('2026-10-01', 'UTC')), '2026-10-01T00:00:00.000Z');
    assert.equal(iso(endOfDayInZone('2026-10-02', 'UTC')), '2026-10-02T23:59:59.999Z');
    assert.equal(iso(startOfDayInZone('2026-10-01', 'Asia/Kathmandu')), '2026-09-30T18:15:00.000Z');
});

test('whole-day boundaries stay correct across daylight-saving changes', () => {
    // US DST starts 8 Mar 2026: the day begins in EST (-5) and ends in EDT (-4).
    assert.equal(iso(startOfDayInZone('2026-03-08', 'America/New_York')), '2026-03-08T05:00:00.000Z');
    assert.equal(iso(endOfDayInZone('2026-03-08', 'America/New_York')), '2026-03-09T03:59:59.999Z');
    // US DST ends 1 Nov 2026: begins in EDT, ends in EST.
    assert.equal(iso(startOfDayInZone('2026-11-01', 'America/New_York')), '2026-11-01T04:00:00.000Z');
    assert.equal(iso(endOfDayInZone('2026-11-01', 'America/New_York')), '2026-11-02T04:59:59.999Z');
});

test('a stored instant reads back as the same calendar day in its timezone', () => {
    const start = startOfDayInZone('2026-10-01', 'Asia/Kolkata');
    const end = endOfDayInZone('2026-10-01', 'Asia/Kolkata');
    assert.equal(toDateKey(start, 'Asia/Kolkata'), '2026-10-01');
    assert.equal(toDateKey(end, 'Asia/Kolkata'), '2026-10-01');
    assert.equal(normalizeDateKey(start, 'Asia/Kolkata'), '2026-10-01');
    assert.equal(normalizeDateKey('2026-10-01', 'Asia/Kolkata'), '2026-10-01');
    assert.equal(normalizeDateKey('', 'Asia/Kolkata'), null);
    assert.equal(normalizeDateKey('not a date', 'Asia/Kolkata'), null);
});

test('isDateBeforeToday uses the discount timezone, not the server one', () => {
    const now = new Date('2026-09-30T20:00:00Z'); // 1 Oct 01:30 in India, still 30 Sep in UTC
    assert.equal(isDateBeforeToday('2026-09-30', 'Asia/Kolkata', now), true);
    assert.equal(isDateBeforeToday('2026-09-30', 'UTC', now), false);
    assert.equal(isDateBeforeToday('2026-10-01', 'Asia/Kolkata', now), false);
});

test('timezone and time parsing', () => {
    assert.equal(isValidTimezone('Asia/Kolkata'), true);
    assert.equal(isValidTimezone('Mars/Olympus'), false);
    assert.equal(isValidTimezone(''), false);
    assert.equal(timeToMinutes('00:00'), 0);
    assert.equal(timeToMinutes('23:59'), 1439);
    assert.equal(timeToMinutes('24:00'), null);
    assert.equal(timeToMinutes('9:00'), null);
});

const ist = (local) => new Date(`${local}+05:30`);
const windowFor = (over) => ({
    isDiscountOpenForSpecificDays: true,
    specificDays: ['MONDAY'],
    isDiscountOpenForSpecificHours: false,
    specificHoursStartTime: null,
    specificHoursEndTime: null,
    timezone: 'Asia/Kolkata',
    ...over
});

test('no day restriction is always open', () => {
    assert.deepEqual(checkDaysAndHoursWindow({ isDiscountOpenForSpecificDays: false }, new Date()), { open: true });
});

test('specific days only', () => {
    // 5 Oct 2026 is a Monday.
    assert.equal(checkDaysAndHoursWindow(windowFor(), ist('2026-10-05T00:00:00')).open, true);
    assert.equal(checkDaysAndHoursWindow(windowFor(), ist('2026-10-05T23:59:00')).open, true);
    const closed = checkDaysAndHoursWindow(windowFor(), ist('2026-10-06T00:00:00'));
    assert.equal(closed.open, false);
    assert.equal(closed.reason, 'This discount is only available on Monday.');
    // The weekday is taken in the discount's zone: Monday 01:00 IST is still Sunday in UTC.
    assert.equal(checkDaysAndHoursWindow(windowFor(), ist('2026-10-05T01:00:00')).open, true);
});

test('same-day hours window is start-inclusive, end-exclusive', () => {
    const d = windowFor({ isDiscountOpenForSpecificHours: true, specificHoursStartTime: '10:00', specificHoursEndTime: '18:00' });
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-05T09:59:00')).open, false);
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-05T10:00:00')).open, true);
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-05T17:59:59')).open, true);
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-05T18:00:00')).open, false);
    // Right hours, wrong day.
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-06T12:00:00')).open, false);
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-06T12:00:00')).reason, 'This discount is only available on Monday, from 10:00 to 18:00.');
});

test('overnight hours window belongs to the day it starts on', () => {
    // 2 Oct 2026 is a Friday.
    const d = windowFor({ specificDays: ['FRIDAY'], isDiscountOpenForSpecificHours: true, specificHoursStartTime: '22:00', specificHoursEndTime: '02:00' });
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-02T21:59:00')).open, false);
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-02T22:00:00')).open, true);
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-02T23:59:00')).open, true);
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-03T01:59:00')).open, true); // Saturday early morning
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-03T02:00:00')).open, false);
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-02T01:00:00')).open, false); // Thursday's night, not Friday's
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-03T22:30:00')).open, false); // Saturday evening
});

test('a zero-length or malformed hours window is never open', () => {
    const same = windowFor({ isDiscountOpenForSpecificHours: true, specificHoursStartTime: '10:00', specificHoursEndTime: '10:00' });
    assert.equal(checkDaysAndHoursWindow(same, ist('2026-10-05T10:00:00')).open, false);
    const broken = windowFor({ isDiscountOpenForSpecificHours: true, specificHoursStartTime: 'x', specificHoursEndTime: '10:00' });
    assert.equal(checkDaysAndHoursWindow(broken, ist('2026-10-05T10:00:00')).open, false);
});

test('an invalid stored timezone falls back to Asia/Kolkata instead of throwing', () => {
    const d = windowFor({ timezone: 'Not/AZone' });
    assert.equal(checkDaysAndHoursWindow(d, ist('2026-10-05T12:00:00')).open, true);
});
