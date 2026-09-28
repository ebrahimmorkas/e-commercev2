/**
 * Delivery date helpers. The backend stores Order.estimatedDeliveryDate at
 * UTC midnight of the picked day and takes/sends it as 'YYYY-MM-DD', so the
 * day is always read from the UTC part and never shifted by the browser's
 * time zone.
 */

/** 'YYYY-MM-DD' for a Date the DatePicker returned (a local day). */
export const toDeliveryDateValue = (date) => {
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** The order's delivery date as 'YYYY-MM-DD', or '' when none is set. */
export const orderDeliveryDateValue = (order) =>
  order?.estimatedDeliveryDate ? String(order.estimatedDeliveryDate).slice(0, 10) : '';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "28 Sep 2026" (same format as the emails), or '' when none is set. Built by
 * hand because toLocaleDateString's short month differs between browsers
 * ("Sep" vs "Sept").
 */
export const formatDeliveryDate = (order) => {
  if (!order?.estimatedDeliveryDate) return '';
  const date = new Date(order.estimatedDeliveryDate);
  return `${String(date.getUTCDate()).padStart(2, '0')} ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

/** Local midnight today - the earliest day the pickers allow. */
export const todayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
