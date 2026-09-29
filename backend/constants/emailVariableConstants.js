const { EMAIL_MODULES } = require('./emailModuleConstants');

// Which {{variables}} a vendor can use when authoring a template for a given
// module - consumed by GET /api/email-templates/variables/:module so a
// template-authoring UI can show the vendor what's available instead of
// them guessing/reading code. Keep this in sync BY HAND with whatever
// `tokens` object each module's notify function actually builds (e.g.
// orderService.notifyOrderStatusChange) - there's no automatic link between
// the two, this is just documentation surfaced through an API.
// Shared by every delivery-agent module.
// {{courierName}} is the order's courier, or the company name (Company
// Settings) when it has none. It's only offered while the courier feature is
// on - see getAvailableVariables in emailTemplateMasterController.
const COURIER_NAME_VARIABLE = { key: 'courierName', description: "The order's courier, or your company name when no courier is assigned" };

const DELIVERY_AGENT_VARIABLES = [
    { key: 'customerName', description: "The customer's name" },
    { key: 'orderNumber', description: "The order's number" },
    { key: 'agentName', description: "The delivery agent's name" },
    { key: 'agentPhone', description: "The delivery agent's phone number" },
    { key: 'deliveryDate', description: 'The delivery date set for the order (e.g. 28 Sep 2026)' },
    COURIER_NAME_VARIABLE
];

// Amounts are shown in each customer's own currency (converted from the
// store currency - see promotionEmailService.buildCustomerMoneyFormatter);
// Free Cash Used/Refunded use the order's own currency instead.
const DISCOUNT_VARIABLES = [
    { key: 'customerName', description: "The customer's name" },
    { key: 'discountName', description: "The discount's name" },
    { key: 'discountDescription', description: "The discount's description" },
    { key: 'discountValue', description: 'What the discount gives, e.g. "10%" or "₹100.00"' },
    { key: 'couponCode', description: 'The coupon code to enter at checkout (blank when the discount applies automatically)' },
    { key: 'startDate', description: 'When the discount starts, e.g. 28 Sep 2026' },
    { key: 'endDate', description: 'When the discount ends, e.g. 30 Sep 2026 (or "No end date")' },
    { key: 'minimumOrderAmount', description: 'Minimum order amount needed for the discount (blank when there is none)' },
    { key: 'minimumQuantity', description: 'Minimum quantity needed for the discount (blank when there is none)' },
    { key: 'validDays', description: 'Days the discount works on, e.g. "Monday, Friday" (blank when every day)' },
    { key: 'validHours', description: 'Hours the discount works in, e.g. "10:00 - 18:00" (blank when all day)' },
    { key: 'firstOrderOnly', description: '"Yes" when the discount is for the first order only, else "No"' },
    { key: 'paymentMethods', description: 'Payment methods the discount is limited to (blank when any)' },
    { key: 'appliesTo', description: 'What the discount applies to, e.g. "All products" or "Selected categories"' }
];

const FREE_CASH_VARIABLES = [
    { key: 'customerName', description: "The customer's name" },
    { key: 'freeCashName', description: "The Free Cash campaign's name" },
    { key: 'freeCashAmount', description: 'The Free Cash amount given, e.g. "₹500.00"' },
    { key: 'remainingAmount', description: 'How much of it is left to use' },
    { key: 'maxUsagePerOrder', description: 'The most that can be used on one order (blank when there is no limit)' },
    { key: 'minimumOrderAmount', description: 'Minimum order amount needed to use it (blank when there is none)' },
    { key: 'startDate', description: 'When it can first be used, e.g. 28 Sep 2026' },
    { key: 'endDate', description: 'When it expires, e.g. 30 Sep 2026' },
    { key: 'canCombineWithDiscounts', description: '"Yes" when it can be used together with discounts, else "No"' }
];

const COURIER_VARIABLES = [
    { key: 'customerName', description: "The customer's name" },
    { key: 'orderNumber', description: "The order's number" },
    COURIER_NAME_VARIABLE,
    { key: 'trackingNumber', description: "The order's tracking number" }
];

const EMAIL_MODULE_VARIABLES = {
    [EMAIL_MODULES.ORDER]: [
        { key: 'customerName', description: "The customer's name" },
        { key: 'orderNumber', description: "The order's number" },
        { key: 'stepName', description: 'The name of the status the order just reached' },
        { key: 'trackingNumber', description: "The order's tracking number" },
        COURIER_NAME_VARIABLE,
        { key: 'estimatedDeliveryDate', description: 'Estimated delivery date, if one is set' },
        { key: 'deliveryDate', description: 'The delivery date set for the order, if one is set (same as estimatedDeliveryDate)' },
        { key: 'agentName', description: "The assigned delivery agent's name, if an agent is assigned" },
        { key: 'agentPhone', description: "The assigned delivery agent's phone number, if an agent is assigned" },
        { key: 'remarks', description: 'Any remarks attached to this status change' }
    ],
    [EMAIL_MODULES.DELIVERY_AGENT_ASSIGNED]: DELIVERY_AGENT_VARIABLES,
    [EMAIL_MODULES.DELIVERY_AGENT_CHANGED]: [
        ...DELIVERY_AGENT_VARIABLES,
        { key: 'previousAgentName', description: 'The name of the delivery agent who was replaced' }
    ],
    // agentName/agentPhone here are the agent who was taken off the order.
    [EMAIL_MODULES.DELIVERY_AGENT_UNASSIGNED]: DELIVERY_AGENT_VARIABLES,
    [EMAIL_MODULES.DELIVERY_DATE_CHANGED]: [
        ...DELIVERY_AGENT_VARIABLES,
        { key: 'previousDeliveryDate', description: 'The delivery date before this change' }
    ],
    [EMAIL_MODULES.COURIER_ASSIGNED]: COURIER_VARIABLES,
    [EMAIL_MODULES.COURIER_CHANGED]: [
        ...COURIER_VARIABLES,
        { key: 'previousCourierName', description: 'The courier that was replaced' }
    ],
    // courierName here is the courier that was just removed.
    [EMAIL_MODULES.COURIER_REMOVED]: COURIER_VARIABLES,
    [EMAIL_MODULES.DISCOUNT_AVAILABLE]: DISCOUNT_VARIABLES,
    [EMAIL_MODULES.DISCOUNT_EXPIRING_SOON]: DISCOUNT_VARIABLES,
    [EMAIL_MODULES.FREE_CASH_CREDITED]: FREE_CASH_VARIABLES,
    [EMAIL_MODULES.FREE_CASH_USED]: [
        ...FREE_CASH_VARIABLES,
        { key: 'amountUsed', description: 'How much Free Cash was used on the order' },
        { key: 'orderNumber', description: 'The order it was used on' }
    ],
    [EMAIL_MODULES.FREE_CASH_REFUNDED]: [
        ...FREE_CASH_VARIABLES,
        { key: 'amountRefunded', description: 'How much Free Cash was given back' },
        { key: 'orderNumber', description: 'The order that was returned' }
    ],
    [EMAIL_MODULES.FREE_CASH_REVOKED]: FREE_CASH_VARIABLES,
    // Sent when a newer Free Cash replaced this one (Free Cash stacking is off).
    [EMAIL_MODULES.FREE_CASH_EXPIRED]: FREE_CASH_VARIABLES,
    [EMAIL_MODULES.FREE_CASH_EXPIRING_SOON]: FREE_CASH_VARIABLES
};

module.exports = {
    EMAIL_MODULE_VARIABLES
};
