import { GIVE_FREE_CASH_TO_CONFIG } from '../constants';
import { DEFAULT_TIMEZONE, isValidTimezone, toDateInputValue, formatZonedDate } from '../../../../utils/zonedDate';

// Dates are whole days in the campaign's own timezone - see utils/zonedDate.js.
export { DEFAULT_TIMEZONE, isValidTimezone };
export const formatFreeCashDate = formatZonedDate;

export const needsExcelFor = (giveFreeCashTo) => {
  const config = GIVE_FREE_CASH_TO_CONFIG[giveFreeCashTo];
  return !!(config && config.needsUsersFile);
};

/**
 * Editing a Specific Users campaign without changing the option: the server
 * keeps the customers it already has, so a new excel is optional (uploading
 * one replaces the list - new customers get it, removed ones lose their
 * unused balance).
 */
export const canKeepExistingUsers = (draft) =>
  !!draft.savedGiveFreeCashTo
  && draft.savedGiveFreeCashTo === draft.giveFreeCashTo
  && needsExcelFor(draft.giveFreeCashTo)
  && (draft.existingTargetCount || 0) > 0;

export const emptyDraft = () => ({
  _id: null,
  // "Notify customers by email" - a per-save choice, never stored on the campaign.
  notifyCustomers: false,
  freeCashName: '',
  freeCashAmount: '',
  maxCashUsagePerOrder: '',

  giveFreeCashTo: 'ALL_USERS',
  savedGiveFreeCashTo: null,
  excelFile: null,
  userGroupIds: [],
  mainCategoryIds: [],
  subCategoryIds: [],
  existingTargetCount: null,

  startDate: '',
  endDate: '',
  timezone: DEFAULT_TIMEZONE,
  validAbove: '0',
  canBeUsedWithOtherDiscounts: false,

  remarks: '',
  status: 'A',
});

/**
 * Converts a FreeCash doc returned by the API (get-by-id / admin list) into
 * form draft shape. giveToUsers resolved via a previous excel upload cannot
 * be re-displayed by name (the API doesn't populate it) - only its count is
 * shown; saving without a new excel keeps it (see canKeepExistingUsers).
 */
export const mapApiFreeCashToDraft = (doc) => ({
  _id: doc._id,
  notifyCustomers: false,
  freeCashName: doc.freeCashName || '',
  freeCashAmount: doc.freeCashAmount ?? '',
  maxCashUsagePerOrder: doc.maxCashUsagePerOrder ?? '',

  giveFreeCashTo: doc.giveFreeCashTo || 'ALL_USERS',
  savedGiveFreeCashTo: doc.giveFreeCashTo || null,
  excelFile: null,
  userGroupIds: (doc.userGroupIds || []).map(String),
  mainCategoryIds: (doc.mainCategoryIds || []).map(String),
  subCategoryIds: (doc.subCategoryIds || []).map(String),
  existingTargetCount: (doc.giveToUsers || []).length,

  startDate: toDateInputValue(doc.startDate, doc.timezone),
  endDate: toDateInputValue(doc.endDate, doc.timezone),
  timezone: doc.timezone || DEFAULT_TIMEZONE,
  validAbove: String(doc.validAbove ?? 0),
  canBeUsedWithOtherDiscounts: !!doc.canBeUsedWithOtherDiscounts,

  remarks: doc.remarks || '',
  status: doc.status || 'A',
});

/**
 * Builds the field set the API expects (see freeCashService.js's
 * create/updateFreeCash) - only sends the targeting fields the chosen
 * giveFreeCashTo option actually needs, same "don't send what doesn't apply"
 * convention as admin/features/discounts/utils/discountDraft.js.
 *
 * @param {Object} draft
 * @param {Object} options
 * @param {boolean} options.includeStatus - only send `status` on update (create always forces 'A' server-side)
 */
export const buildSubmitFields = (draft, { includeStatus = false } = {}) => {
  const config = GIVE_FREE_CASH_TO_CONFIG[draft.giveFreeCashTo] || {};

  const fields = {
    freeCashName: draft.freeCashName.trim(),
    freeCashAmount: Number(draft.freeCashAmount),
    giveFreeCashTo: draft.giveFreeCashTo,
    startDate: draft.startDate,
    endDate: draft.endDate,
    timezone: (draft.timezone || '').trim() || DEFAULT_TIMEZONE,
    validAbove: Number(draft.validAbove) || 0,
    canBeUsedWithOtherDiscounts: !!draft.canBeUsedWithOtherDiscounts,
    remarks: draft.remarks || '',
    notifyCustomers: !!draft.notifyCustomers,
  };

  // Blank = no per-order limit (sent as null so an edit can remove a limit).
  fields.maxCashUsagePerOrder = draft.maxCashUsagePerOrder !== '' && draft.maxCashUsagePerOrder !== null && draft.maxCashUsagePerOrder !== undefined
    ? Number(draft.maxCashUsagePerOrder)
    : null;

  if (config.needsUserGroupIds) fields.userGroupIds = draft.userGroupIds;
  if (config.needsMainCategoryIds) fields.mainCategoryIds = draft.mainCategoryIds;
  if (config.needsSubCategoryIds) fields.subCategoryIds = draft.subCategoryIds;

  if (includeStatus) fields.status = draft.status;

  return fields;
};

export default {
  emptyDraft,
  mapApiFreeCashToDraft,
  buildSubmitFields,
  needsExcelFor,
  canKeepExistingUsers,
  formatFreeCashDate,
  isValidTimezone,
};
