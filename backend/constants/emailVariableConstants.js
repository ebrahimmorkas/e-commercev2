const { EMAIL_MODULES } = require('./emailModuleConstants');

// Which {{variables}} a vendor can use when authoring a template for a given
// module - consumed by GET /api/email-templates/variables/:module so a
// template-authoring UI can show the vendor what's available instead of
// them guessing/reading code. Keep this in sync BY HAND with whatever
// `tokens` object each module's notify function actually builds (e.g.
// orderService.notifyOrderStatusChange) - there's no automatic link between
// the two, this is just documentation surfaced through an API.
const EMAIL_MODULE_VARIABLES = {
    [EMAIL_MODULES.ORDER]: [
        { key: 'customerName', description: "The customer's name" },
        { key: 'orderNumber', description: "The order's number" },
        { key: 'stepName', description: 'The name of the status the order just reached' },
        { key: 'trackingNumber', description: 'Shipment tracking number, if one is set' },
        { key: 'courierName', description: 'Courier/shipping company name, if one is set' },
        { key: 'estimatedDeliveryDate', description: 'Estimated delivery date, if one is set' },
        { key: 'remarks', description: 'Any remarks attached to this status change' }
    ]
};

module.exports = {
    EMAIL_MODULE_VARIABLES
};
