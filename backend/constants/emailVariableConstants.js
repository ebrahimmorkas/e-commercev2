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
    [EMAIL_MODULES.COURIER_REMOVED]: COURIER_VARIABLES
};

module.exports = {
    EMAIL_MODULE_VARIABLES
};
