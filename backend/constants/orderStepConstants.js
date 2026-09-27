// Built-in step codes. A vendor's OrderStepMaster template (assigned through
// CompanyMaster.orderSteps) is the NORMAL flow: any subset of the built-in
// FLOW codes below plus any custom codes (e.g. "IN_PROGRESS", "CONFIRMED"), in
// whatever sequence the platform admin chooses - none of them is required.
// The admin can only move an order to the NEXT step of that flow, and the
// flow's LAST step is final (nothing at all can happen to the order after it).
//
// The SIDE codes are never stored in a template. They sit outside the
// sequence so they can never block "next step"/"last step":
//   REJECTED            - the admin rejected the order.
//   CANCELLED           - the customer cancelled the order.
//   REFUNDED            - a rejected/cancelled order's payment was given back.
//   PAYMENT_AT_DELIVERY - taken INSTEAD of the vendor's payment step (only for
//                         vendors with delivery-agent access): the payment is
//                         collected by the agent, so it is marked paid when the
//                         vendor's delivery-agent transition happens instead.
// Rejected/Cancelled/Refunded orders are not final - they can be restarted
// from the flow's first step (RESTART_ACTION).
const RESERVED_STEP_CODES = {
    ACCEPTED: 'ACCEPTED',
    COMPLETED: 'COMPLETED',
    DELIVERED: 'DELIVERED',
    DISPATCHED: 'DISPATCHED',
    READY_FOR_DELIVERY: 'READY_FOR_DELIVERY',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    PAYMENT_AT_DELIVERY: 'PAYMENT_AT_DELIVERY'
};

// Built-in codes a template may place anywhere in its flow.
const FLOW_STEP_CODES = [
    RESERVED_STEP_CODES.ACCEPTED,
    RESERVED_STEP_CODES.READY_FOR_DELIVERY,
    RESERVED_STEP_CODES.DISPATCHED,
    RESERVED_STEP_CODES.DELIVERED,
    RESERVED_STEP_CODES.COMPLETED
];

// Display names for the side steps (they have no template entry to take a name from).
const SIDE_STEP_NAMES = {
    [RESERVED_STEP_CODES.REJECTED]: 'Rejected',
    [RESERVED_STEP_CODES.CANCELLED]: 'Cancelled',
    [RESERVED_STEP_CODES.REFUNDED]: 'Refunded',
    [RESERVED_STEP_CODES.PAYMENT_AT_DELIVERY]: 'Payment at Delivery'
};

// An order sitting on one of these is "closed": nothing but Refund (when paid)
// and Restart is allowed on it.
const CLOSED_STEP_CODES = [
    RESERVED_STEP_CODES.REJECTED,
    RESERVED_STEP_CODES.CANCELLED,
    RESERVED_STEP_CODES.REFUNDED
];

// Refund is only possible from these.
const REFUNDABLE_STEP_CODES = [
    RESERVED_STEP_CODES.REJECTED,
    RESERVED_STEP_CODES.CANCELLED
];

// Not a step - the action code the admin sends to restart a closed order.
const RESTART_ACTION = 'RESTART';

// Codes a template may never use for its own steps.
const TEMPLATE_FORBIDDEN_CODES = [...Object.keys(SIDE_STEP_NAMES), RESTART_ACTION];

// A return/exchange request can only be opened once the order has reached
// one of these steps.
const RETURN_EXCHANGE_ELIGIBLE_STEP_CODES = [
    RESERVED_STEP_CODES.DELIVERED,
    RESERVED_STEP_CODES.COMPLETED
];

module.exports = {
    RESERVED_STEP_CODES,
    FLOW_STEP_CODES,
    SIDE_STEP_NAMES,
    CLOSED_STEP_CODES,
    REFUNDABLE_STEP_CODES,
    RESTART_ACTION,
    TEMPLATE_FORBIDDEN_CODES,
    RETURN_EXCHANGE_ELIGIBLE_STEP_CODES
};
