import { GIVE_FREE_CASH_TO_CONFIG } from '../constants';

const pad = (n) => String(n).padStart(2, '0');
const toDateInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const needsExcelFor = (giveFreeCashTo) => {
  const config = GIVE_FREE_CASH_TO_CONFIG[giveFreeCashTo];
  return !!(config && config.needsUsersFile);
};

export const emptyDraft = () => ({
  _id: null,
  freeCashName: '',
  freeCashAmount: '',
  maxCashUsagePerOrder: '',

  giveFreeCashTo: 'ALL_USERS',
  excelFile: null,
  userGroupIds: [],
  mainCategoryIds: [],
  subCategoryIds: [],
  existingTargetCount: null,

  startDate: '',
  endDate: '',
  validAbove: '0',
  canBeUsedWithOtherDiscounts: false,

  remarks: '',
  status: 'A',
});

/**
 * Converts a FreeCash doc returned by the API (get-by-id / admin list) into
 * form draft shape. giveToUsers resolved via a previous excel upload cannot
 * be re-displayed by name (the API doesn't populate it, and there's no
 * by-ids lookup endpoint) - only its count is shown, and the excel must be
 * re-uploaded to change or keep it when giveFreeCashTo is SPECIFIC_USERS
 * (see needsExcelFor above).
 */
export const mapApiFreeCashToDraft = (doc) => ({
  _id: doc._id,
  freeCashName: doc.freeCashName || '',
  freeCashAmount: doc.freeCashAmount ?? '',
  maxCashUsagePerOrder: doc.maxCashUsagePerOrder ?? '',

  giveFreeCashTo: doc.giveFreeCashTo || 'ALL_USERS',
  excelFile: null,
  userGroupIds: (doc.userGroupIds || []).map(String),
  mainCategoryIds: (doc.mainCategoryIds || []).map(String),
  subCategoryIds: (doc.subCategoryIds || []).map(String),
  existingTargetCount: (doc.giveToUsers || []).length,

  startDate: toDateInputValue(doc.startDate),
  endDate: toDateInputValue(doc.endDate),
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
    validAbove: Number(draft.validAbove) || 0,
    canBeUsedWithOtherDiscounts: !!draft.canBeUsedWithOtherDiscounts,
    remarks: draft.remarks || '',
  };

  if (draft.maxCashUsagePerOrder !== '' && draft.maxCashUsagePerOrder !== null && draft.maxCashUsagePerOrder !== undefined) {
    fields.maxCashUsagePerOrder = Number(draft.maxCashUsagePerOrder);
  }

  if (config.needsUserGroupIds) fields.userGroupIds = draft.userGroupIds;
  if (config.needsMainCategoryIds) fields.mainCategoryIds = draft.mainCategoryIds;
  if (config.needsSubCategoryIds && draft.subCategoryIds.length > 0) fields.subCategoryIds = draft.subCategoryIds;

  if (includeStatus) fields.status = draft.status;

  return fields;
};

export default {
  emptyDraft,
  mapApiFreeCashToDraft,
  buildSubmitFields,
  needsExcelFor,
};
