// Fixed set of module keys that email-template tagging (CompanySettings.
// emailTemplateAssignments), EmailTemplateMaster.module, and
// DefaultEmailTemplateMaster.module all key off. Keeping this as a shared
// enum (rather than a free string) means a vendor's tag and the platform's
// default templates can never silently mismatch on a typo. Add a new key
// here whenever another feature is wired up to send templated email.
const EMAIL_MODULES = {
    ORDER: 'order',
    // Delivery agent emails to the customer - see orderService
    // (assignDeliveryAgent / unassignDeliveryAgent / changeDeliveryDate).
    DELIVERY_AGENT_ASSIGNED: 'deliveryAgentAssigned',
    DELIVERY_AGENT_CHANGED: 'deliveryAgentChanged',
    DELIVERY_AGENT_UNASSIGNED: 'deliveryAgentUnassigned',
    DELIVERY_DATE_CHANGED: 'deliveryDateChanged',
    // Courier emails to the customer - see orderService.setOrderCourier.
    COURIER_ASSIGNED: 'courierAssigned',
    COURIER_CHANGED: 'courierChanged',
    COURIER_REMOVED: 'courierRemoved'
};

const VALID_EMAIL_MODULES = Object.values(EMAIL_MODULES);

// Human-readable names used in messages shown to the vendor (e.g. "The Order
// module is already assigned to ..."). Mirrors the frontend's
// EMAIL_MODULE_OPTIONS labels - add an entry alongside every new module key.
const EMAIL_MODULE_LABELS = {
    [EMAIL_MODULES.ORDER]: 'Order',
    [EMAIL_MODULES.DELIVERY_AGENT_ASSIGNED]: 'Delivery Agent Assigned',
    [EMAIL_MODULES.DELIVERY_AGENT_CHANGED]: 'Delivery Agent Changed',
    [EMAIL_MODULES.DELIVERY_AGENT_UNASSIGNED]: 'Delivery Agent Unassigned',
    [EMAIL_MODULES.DELIVERY_DATE_CHANGED]: 'Delivery Date Changed',
    [EMAIL_MODULES.COURIER_ASSIGNED]: 'Courier Assigned',
    [EMAIL_MODULES.COURIER_CHANGED]: 'Courier Changed',
    [EMAIL_MODULES.COURIER_REMOVED]: 'Courier Removed'
};

// Modules that only exist while the courier feature is on - hidden from the
// Email Templates page (and their variables) when it's off.
const COURIER_EMAIL_MODULES = [EMAIL_MODULES.COURIER_ASSIGNED, EMAIL_MODULES.COURIER_CHANGED, EMAIL_MODULES.COURIER_REMOVED];

const getEmailModuleLabel = (module) => EMAIL_MODULE_LABELS[module] || module;

module.exports = {
    EMAIL_MODULES,
    VALID_EMAIL_MODULES,
    EMAIL_MODULE_LABELS,
    getEmailModuleLabel,
    COURIER_EMAIL_MODULES
};
