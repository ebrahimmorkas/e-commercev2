// Checkout can't offer the customer any way to pay - Cash on Delivery is off
// and the QR / bank details / GPay could not be loaded or aren't set up. The
// order is then blocked and the customer can report it to the platform owner
// (paymentService.reportCheckoutPaymentIssue).
const CHECKOUT_ISSUE_REASONS = {
    // The /payments/options request itself failed (server error / network).
    OPTIONS_FAILED: 'OPTIONS_FAILED',
    // It worked, but nothing came back to pay with.
    NO_PAYMENT_OPTION: 'NO_PAYMENT_OPTION'
};

const CHECKOUT_ISSUE_REASON_TEXT = {
    [CHECKOUT_ISSUE_REASONS.OPTIONS_FAILED]: "The store's payment options (bank details) could not be loaded.",
    [CHECKOUT_ISSUE_REASONS.NO_PAYMENT_OPTION]: 'Cash on Delivery is off and the store has no QR code, bank details or GPay number to show.'
};

// One report per customer per this many minutes.
const CHECKOUT_ISSUE_REPORT_COOLDOWN_MINUTES = 15;

const CHECKOUT_ISSUE_MESSAGE_MAX_LENGTH = 500;
const CHECKOUT_ISSUE_TOTAL_MAX_LENGTH = 50;
const CHECKOUT_ISSUE_PAGE_URL_MAX_LENGTH = 500;

module.exports = {
    CHECKOUT_ISSUE_REASONS,
    CHECKOUT_ISSUE_REASON_TEXT,
    CHECKOUT_ISSUE_REPORT_COOLDOWN_MINUTES,
    CHECKOUT_ISSUE_MESSAGE_MAX_LENGTH,
    CHECKOUT_ISSUE_TOTAL_MAX_LENGTH,
    CHECKOUT_ISSUE_PAGE_URL_MAX_LENGTH
};
