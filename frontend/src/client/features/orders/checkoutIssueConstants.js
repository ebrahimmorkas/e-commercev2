// Why checkout can't take payment - mirrors backend constants/checkoutIssueConstants.js.
export const CHECKOUT_ISSUE_REASONS = {
  // The payment options could not be loaded at all.
  OPTIONS_FAILED: 'OPTIONS_FAILED',
  // They loaded, but COD is off and there are no bank details / QR / GPay.
  NO_PAYMENT_OPTION: 'NO_PAYMENT_OPTION',
};
