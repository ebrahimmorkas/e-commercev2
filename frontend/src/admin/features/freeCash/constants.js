/**
 * Mirrors backend/constants/freeCashConstants.js's GIVE_FREE_CASH_TO_CONFIG and
 * companyMaster's freeCashOptions enum exactly - this file has no runtime
 * dependency on the backend, so if that contract changes these must be
 * updated to match by hand (same convention as admin/features/discounts/constants.js).
 */

// Keyed the same as backend GIVE_FREE_CASH_TO_CONFIG. `needsUsersFile` means:
// the `excelFile` upload must contain a sheet named "Users". `needsUserGroupIds`
// means: send that field as an array of Group._id values (groupType USER).
// `needsMainCategoryIds` / `needsSubCategoryIds` mean: send that field as an
// array of Category._id values, picked via the category dropdowns.
export const GIVE_FREE_CASH_TO_CONFIG = {
  ALL_USERS: {
    label: 'All Users',
    description: 'Every customer is eligible for this Free Cash.',
  },
  SPECIFIC_USERS: {
    label: 'Specific Users',
    description: 'Only the users listed in the uploaded excel file are eligible.',
    needsUsersFile: true,
  },
  ONLY_MAIN_CATEGORY: {
    label: 'Only Main Category',
    description: 'Eligible only for products inside the selected main category/categories.',
    needsMainCategoryIds: true,
  },
  MAIN_CATEGORY_AND_SUB_CATEGORY: {
    label: 'Main Category + Sub Category',
    description: 'Eligible only for products inside the selected sub-categories. Leave sub-categories empty to allow the whole main category instead.',
    needsMainCategoryIds: true,
    needsSubCategoryIds: true,
  },
  GROUPS: {
    label: 'User Group(s)',
    description: 'Only customers in the selected user group(s) are eligible.',
    needsUserGroupIds: true,
  },
};

export const GIVE_FREE_CASH_TO_OPTIONS = Object.entries(GIVE_FREE_CASH_TO_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
}));

export const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];
