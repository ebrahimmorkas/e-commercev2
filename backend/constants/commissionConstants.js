// Lifecycle of a single CommissionLedgerEntry. Commission is TRACKED here,
// not collected automatically through the gateway (the vendor's own PayTabs
// account still receives 100% of every payment) - the platform owner
// collects what's owed separately (invoice, bank transfer, etc) and marks
// entries COLLECTED by hand. See commissionService.js.
const COMMISSION_LEDGER_STATUSES = {
    PENDING: 'PENDING',
    COLLECTED: 'COLLECTED',
    VOIDED: 'VOIDED'
};

const VALID_COMMISSION_LEDGER_STATUSES = Object.values(COMMISSION_LEDGER_STATUSES);

module.exports = {
    COMMISSION_LEDGER_STATUSES,
    VALID_COMMISSION_LEDGER_STATUSES
};
