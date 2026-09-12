// Describes, for every giveFreeCashTo enum value, what the frontend must
// supply - same contract as GIVE_DISCOUNT_TO_CONFIG in discountConstants.js:
// - needsUsersFile          : excel upload (resolved via email lookup)
// - needsUserGroupIds       : array of Group ObjectIds already selected via dropdown (groupType 'USER')
// - needsMainCategoryIds    : array of Category ObjectIds (top-level, parent_category_id null)
// - needsSubCategoryIds     : array of Category ObjectIds nested under the selected main categories
const GIVE_FREE_CASH_TO_CONFIG = {
  ALL_USERS: {},
  SPECIFIC_USERS: { needsUsersFile: true },
  ONLY_MAIN_CATEGORY: { needsMainCategoryIds: true },
  MAIN_CATEGORY_AND_SUB_CATEGORY: { needsMainCategoryIds: true, needsSubCategoryIds: true },
  GROUPS: { needsUserGroupIds: true }
};

const FREE_CASH_OPTIONS = Object.keys(GIVE_FREE_CASH_TO_CONFIG);

// Excel column config, built for utils/excelParser.js's generic contract -
// same convention as USERS_EXCEL_COLUMNS in discountConstants.js.
const USERS_EXCEL_COLUMNS = [
  { key: 'email', header: 'Email', required: true }
];

module.exports = {
  GIVE_FREE_CASH_TO_CONFIG,
  FREE_CASH_OPTIONS,
  USERS_EXCEL_COLUMNS
};
