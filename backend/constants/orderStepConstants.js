// Fixed step codes that any OrderStepMaster template must reuse (as
// OrderStepMaster.steps[].code) for a step meant to carry the platform's
// built-in behavior. These 6 always mean the same thing no matter which
// vendor's workflow they appear in, or what display `name` is given to
// them - only the reserved `code` is what business logic (delivery-agent
// authorization, return/exchange eligibility, terminal-state detection)
// keys off. Any OTHER code value on a step is a fully custom step (e.g.
// "IN_PROGRESS", "CONFIRMED") with no special behavior beyond its place
// in the sequence. OrderStepMaster templates are authored by the platform
// admin only, never by vendors, and are not edited once a vendor is
// already using them (companyMaster.orderSteps).
const RESERVED_STEP_CODES = {
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
    DELIVERED: 'DELIVERED',
    DISPATCHED: 'DISPATCHED',
    READY_FOR_DELIVERY: 'READY_FOR_DELIVERY'
};

const VALID_RESERVED_STEP_CODES = Object.values(RESERVED_STEP_CODES);

// Once an order's current step reaches one of these, it is a dead end - no
// further step transitions are allowed for that order at all. NOTE: don't
// design a template where COMPLETED comes AFTER DELIVERED in sequence -
// reaching DELIVERED locks the order before it could ever reach COMPLETED.
const TERMINAL_STEP_CODES = [
    RESERVED_STEP_CODES.COMPLETED,
    RESERVED_STEP_CODES.DELIVERED
];

// A return/exchange request can only be opened once the order has reached
// one of these steps.
const RETURN_EXCHANGE_ELIGIBLE_STEP_CODES = [
    RESERVED_STEP_CODES.DELIVERED,
    RESERVED_STEP_CODES.COMPLETED
];

// A delivery agent may only move an order forward from DISPATCHED to
// DELIVERED, and only when that order is assigned to them.
const DELIVERY_AGENT_FROM_STEP_CODE = RESERVED_STEP_CODES.DISPATCHED;
const DELIVERY_AGENT_TO_STEP_CODE = RESERVED_STEP_CODES.DELIVERED;

module.exports = {
    RESERVED_STEP_CODES,
    VALID_RESERVED_STEP_CODES,
    TERMINAL_STEP_CODES,
    RETURN_EXCHANGE_ELIGIBLE_STEP_CODES,
    DELIVERY_AGENT_FROM_STEP_CODE,
    DELIVERY_AGENT_TO_STEP_CODE
};
