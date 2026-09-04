import { GIVE_DISCOUNT_TO_CONFIG } from '../constants';

const pad = (n) => String(n).padStart(2, '0');
const toDateInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const needsExcelFor = (giveDiscountTo) => {
  const config = GIVE_DISCOUNT_TO_CONFIG[giveDiscountTo];
  return !!(config && (config.needsProductsFile || config.needsCategoriesFile || config.needsUsersFile));
};

export const requiredExcelSheetsFor = (giveDiscountTo) => {
  const config = GIVE_DISCOUNT_TO_CONFIG[giveDiscountTo];
  if (!config) return [];
  const sheets = [];
  if (config.needsProductsFile) sheets.push('Products');
  if (config.needsCategoriesFile) sheets.push('Categories');
  if (config.needsUsersFile) sheets.push('Users');
  return sheets;
};

export const emptyDraft = () => ({
  _id: null,
  name: '',
  description: '',
  remarks: '',
  internalNotes: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  precedence: '0',
  autoApply: false,

  giveDiscountTo: 'ALL_PRODUCTS_ALL_USERS',
  excelFile: null,
  productGroupIds: [],
  categoryGroupIds: [],
  userGroupIds: [],
  existingTargetCounts: null,

  discountFlow: 'SCHEDULED',
  startDate: '',
  endDate: '',
  minimumQuantity: '',
  couponCode: '',
  discountValidAboveAmount: '0',

  isDiscountOpenForSpecificDays: false,
  specificDays: [],
  isDiscountOpenForSpecificHours: false,
  specificHoursStartTime: '',
  specificHoursEndTime: '',
  timezone: 'Asia/Kolkata',

  isDiscountBasedOnPaymentMethods: false,
  discountOnPaymentMethods: [],

  numberOfUsersCanUseDiscount: '',
  isMultipleDiscountUsageOn: false,
  isDiscountReusable: false,
  discountReusableNumber: '',
  firstOrderOnly: false,

  status: 'A',
});

/**
 * Converts a Discount doc returned by the API (get-by-id / admin list) into
 * form draft shape. productIds/categoryIds/userIds resolved via a previous
 * excel upload cannot be re-displayed by name (the API doesn't populate them,
 * and there's no by-ids lookup endpoint) - only their count is shown, and the
 * excel must be re-uploaded to change or keep them (see needsExcelFor above).
 */
export const mapApiDiscountToDraft = (doc) => ({
  _id: doc._id,
  name: doc.name || '',
  description: doc.description || '',
  remarks: doc.remarks || '',
  internalNotes: doc.internalNotes || '',
  discountType: doc.discountType || 'PERCENTAGE',
  discountValue: doc.discountValue ?? '',
  precedence: String(doc.precedence ?? 0),
  autoApply: !!doc.autoApply,

  giveDiscountTo: doc.giveDiscountTo || 'ALL_PRODUCTS_ALL_USERS',
  excelFile: null,
  productGroupIds: (doc.productGroupIds || []).map(String),
  categoryGroupIds: (doc.categoryGroupIds || []).map(String),
  userGroupIds: (doc.userGroupIds || []).map(String),
  existingTargetCounts: {
    products: (doc.productIds || []).length,
    categories: (doc.categoryIds || []).length,
    users: (doc.userIds || []).length,
  },

  discountFlow: doc.isOngoingDiscount ? 'ONGOING' : doc.isMinimumDiscountQuantityDiscount ? 'MIN_QTY' : doc.isCouponCodeDiscount ? 'COUPON' : 'SCHEDULED',
  startDate: toDateInputValue(doc.startDate),
  endDate: toDateInputValue(doc.endDate),
  minimumQuantity: doc.minimumQuantity ?? '',
  couponCode: doc.couponCode || '',
  discountValidAboveAmount: String(doc.discountValidAboveAmount ?? 0),

  isDiscountOpenForSpecificDays: !!doc.isDiscountOpenForSpecificDays,
  specificDays: doc.specificDays || [],
  isDiscountOpenForSpecificHours: !!doc.isDiscountOpenForSpecificHours,
  specificHoursStartTime: doc.specificHoursStartTime || '',
  specificHoursEndTime: doc.specificHoursEndTime || '',
  timezone: doc.timezone || 'Asia/Kolkata',

  isDiscountBasedOnPaymentMethods: !!doc.isDiscountBasedOnPaymentMethods,
  discountOnPaymentMethods: doc.discountOnPaymentMethods || [],

  numberOfUsersCanUseDiscount: doc.numberOfUsersCanUseDiscount ?? '',
  isMultipleDiscountUsageOn: !!doc.isMultipleDiscountUsageOn,
  isDiscountReusable: !!doc.isDiscountReusable,
  discountReusableNumber: doc.discountReusableNumber ?? '',
  firstOrderOnly: !!doc.firstOrderOnly,

  status: doc.status || 'A',
});

/**
 * Builds the field set the API expects (see discountService.js's
 * create/updateDiscount), applying the same "zero out what doesn't apply"
 * rules the backend itself applies (e.g. discountValidAboveAmount forced to 0
 * for a minimum-quantity discount) so the review step reflects what will
 * actually be saved.
 *
 * @param {Object} draft
 * @param {Object} options
 * @param {boolean} options.includeStatus - only send `status` on update (create always forces 'A' server-side)
 */
export const buildSubmitFields = (draft, { includeStatus = false } = {}) => {
  const isOngoing = draft.discountFlow === 'ONGOING';
  const isMinQty = draft.discountFlow === 'MIN_QTY';
  const isCoupon = draft.discountFlow === 'COUPON';

  const config = GIVE_DISCOUNT_TO_CONFIG[draft.giveDiscountTo] || {};

  const fields = {
    name: draft.name.trim(),
    description: draft.description || '',
    remarks: draft.remarks || '',
    internalNotes: draft.internalNotes || '',
    discountType: draft.discountType,
    discountValue: Number(draft.discountValue),
    giveDiscountTo: draft.giveDiscountTo,
    precedence: Number(draft.precedence) || 0,
    autoApply: !!draft.autoApply,

    isOngoingDiscount: isOngoing,
    isMinimumDiscountQuantityDiscount: isMinQty,
    isCouponCodeDiscount: isCoupon,

    isMultipleDiscountUsageOn: !!draft.isMultipleDiscountUsageOn,
    isDiscountReusable: !!draft.isDiscountReusable,
    firstOrderOnly: !!draft.firstOrderOnly,

    isDiscountOpenForSpecificDays: !!draft.isDiscountOpenForSpecificDays,
    isDiscountOpenForSpecificHours: !!draft.isDiscountOpenForSpecificDays && !!draft.isDiscountOpenForSpecificHours,
    timezone: draft.timezone || 'Asia/Kolkata',

    isDiscountBasedOnPaymentMethods: !!draft.isDiscountBasedOnPaymentMethods,
  };

  if (!isOngoing) {
    fields.startDate = draft.startDate;
    fields.endDate = draft.endDate;
  }
  if (isMinQty) {
    fields.minimumQuantity = Number(draft.minimumQuantity);
    fields.discountValidAboveAmount = 0;
  } else {
    fields.discountValidAboveAmount = Number(draft.discountValidAboveAmount) || 0;
  }
  if (isCoupon) {
    fields.couponCode = draft.couponCode.trim().toUpperCase();
  }

  if (draft.isDiscountOpenForSpecificDays) {
    fields.specificDays = draft.specificDays;
    if (draft.isDiscountOpenForSpecificHours) {
      fields.specificHoursStartTime = draft.specificHoursStartTime;
      fields.specificHoursEndTime = draft.specificHoursEndTime;
    }
  }

  if (draft.isDiscountBasedOnPaymentMethods) {
    fields.discountOnPaymentMethods = draft.discountOnPaymentMethods;
  }

  if (draft.numberOfUsersCanUseDiscount !== '' && draft.numberOfUsersCanUseDiscount !== null && draft.numberOfUsersCanUseDiscount !== undefined) {
    fields.numberOfUsersCanUseDiscount = Number(draft.numberOfUsersCanUseDiscount);
  }
  if (draft.isDiscountReusable) {
    fields.discountReusableNumber = Number(draft.discountReusableNumber);
  }

  if (config.needsProductGroupIds) fields.productGroupIds = draft.productGroupIds;
  if (config.needsCategoryGroupIds) fields.categoryGroupIds = draft.categoryGroupIds;
  if (config.needsUserGroupIds) fields.userGroupIds = draft.userGroupIds;

  if (includeStatus) fields.status = draft.status;

  return fields;
};

export default {
  emptyDraft,
  mapApiDiscountToDraft,
  buildSubmitFields,
  needsExcelFor,
  requiredExcelSheetsFor,
};
