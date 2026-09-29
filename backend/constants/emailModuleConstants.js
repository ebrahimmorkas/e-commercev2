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
    COURIER_REMOVED: 'courierRemoved',
    // Discount / Free Cash emails to customers - see promotionEmailService.
    DISCOUNT_AVAILABLE: 'discountAvailable',
    DISCOUNT_EXPIRING_SOON: 'discountExpiringSoon',
    FREE_CASH_CREDITED: 'freeCashCredited',
    FREE_CASH_USED: 'freeCashUsed',
    FREE_CASH_REFUNDED: 'freeCashRefunded',
    FREE_CASH_REVOKED: 'freeCashRevoked',
    FREE_CASH_EXPIRED: 'freeCashExpired',
    FREE_CASH_EXPIRING_SOON: 'freeCashExpiringSoon'
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
    [EMAIL_MODULES.COURIER_REMOVED]: 'Courier Removed',
    [EMAIL_MODULES.DISCOUNT_AVAILABLE]: 'Discount Available',
    [EMAIL_MODULES.DISCOUNT_EXPIRING_SOON]: 'Discount Expiring Soon',
    [EMAIL_MODULES.FREE_CASH_CREDITED]: 'Free Cash Credited',
    [EMAIL_MODULES.FREE_CASH_USED]: 'Free Cash Used',
    [EMAIL_MODULES.FREE_CASH_REFUNDED]: 'Free Cash Refunded',
    [EMAIL_MODULES.FREE_CASH_REVOKED]: 'Free Cash Revoked',
    [EMAIL_MODULES.FREE_CASH_EXPIRED]: 'Free Cash Expired',
    [EMAIL_MODULES.FREE_CASH_EXPIRING_SOON]: 'Free Cash Expiring Soon'
};

// Modules that only exist while the courier feature is on - hidden from the
// Email Templates page (and their variables) when it's off.
const COURIER_EMAIL_MODULES = [EMAIL_MODULES.COURIER_ASSIGNED, EMAIL_MODULES.COURIER_CHANGED, EMAIL_MODULES.COURIER_REMOVED];

const DISCOUNT_EMAIL_MODULES = [EMAIL_MODULES.DISCOUNT_AVAILABLE, EMAIL_MODULES.DISCOUNT_EXPIRING_SOON];

const FREE_CASH_EMAIL_MODULES = [
    EMAIL_MODULES.FREE_CASH_CREDITED, EMAIL_MODULES.FREE_CASH_USED, EMAIL_MODULES.FREE_CASH_REFUNDED,
    EMAIL_MODULES.FREE_CASH_REVOKED, EMAIL_MODULES.FREE_CASH_EXPIRED, EMAIL_MODULES.FREE_CASH_EXPIRING_SOON
];

// The WebsiteMaster AND CompanyMaster feature a module belongs to - while
// that feature is off, the module is hidden on the Email Templates page and
// can't be picked (see emailTemplateMasterService.checkModuleAllowed).
const MODULE_REQUIRED_FEATURE = {
    ...Object.fromEntries(COURIER_EMAIL_MODULES.map((m) => [m, 'isCourierFeatureOn'])),
    ...Object.fromEntries(DISCOUNT_EMAIL_MODULES.map((m) => [m, 'isDiscountFeatureOn'])),
    ...Object.fromEntries(FREE_CASH_EMAIL_MODULES.map((m) => [m, 'isFreeCashFeatureOn']))
};

// The on/off switch (WebsiteMaster AND CompanyMaster) for each Discount /
// Free Cash email - same two-level pattern as the order/courier emails.
const PROMOTION_EMAIL_FLAGS = {
    [EMAIL_MODULES.DISCOUNT_AVAILABLE]: 'isEmailSendingFeatureOnAfterDiscountAvailable',
    [EMAIL_MODULES.DISCOUNT_EXPIRING_SOON]: 'isEmailSendingFeatureOnBeforeDiscountExpires',
    [EMAIL_MODULES.FREE_CASH_CREDITED]: 'isEmailSendingFeatureOnAfterFreeCashCredited',
    [EMAIL_MODULES.FREE_CASH_USED]: 'isEmailSendingFeatureOnAfterFreeCashUsed',
    [EMAIL_MODULES.FREE_CASH_REFUNDED]: 'isEmailSendingFeatureOnAfterFreeCashRefunded',
    [EMAIL_MODULES.FREE_CASH_REVOKED]: 'isEmailSendingFeatureOnAfterFreeCashRevoked',
    [EMAIL_MODULES.FREE_CASH_EXPIRED]: 'isEmailSendingFeatureOnAfterFreeCashExpired',
    [EMAIL_MODULES.FREE_CASH_EXPIRING_SOON]: 'isEmailSendingFeatureOnBeforeFreeCashExpires'
};

const getEmailModuleLabel = (module) => EMAIL_MODULE_LABELS[module] || module;

module.exports = {
    EMAIL_MODULES,
    VALID_EMAIL_MODULES,
    EMAIL_MODULE_LABELS,
    getEmailModuleLabel,
    COURIER_EMAIL_MODULES,
    DISCOUNT_EMAIL_MODULES,
    FREE_CASH_EMAIL_MODULES,
    MODULE_REQUIRED_FEATURE,
    PROMOTION_EMAIL_FLAGS
};
