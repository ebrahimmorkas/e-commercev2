/**
 * Calendar-day helpers for records whose dates are whole days in their own
 * timezone (discounts, Free Cash): the backend stores 00:00 on the start day
 * and 23:59:59.999 on the end day in that zone, so a stored instant must be
 * read back in that zone - never the browser's.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const isValidTimezone = (timezone) => {
  if (!timezone || !String(timezone).trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const zoneOrDefault = (timezone) => (isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE);

/** A stored instant as its "YYYY-MM-DD" calendar day in `timezone` (for a date input). */
export const toDateInputValue = (value, timezone = DEFAULT_TIMEZONE) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: zoneOrDefault(timezone), year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

/** "1 Oct 2026" for a stored instant, read in `timezone`. */
export const formatZonedDate = (value, timezone = DEFAULT_TIMEZONE) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { timeZone: zoneOrDefault(timezone), day: 'numeric', month: 'short', year: 'numeric' });
};
