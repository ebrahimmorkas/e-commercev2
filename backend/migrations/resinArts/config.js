// Fixed choices of the resinArts -> e-commercev2 data migration. Anything that
// was a decision (rather than a straight field copy) lives here so it can be
// changed in one place before the production run.

module.exports = {
    // Where the mongodump of the resinArts production database lives
    // (categories.bson / products.bson / users.bson). Override with --backup.
    DEFAULT_BACKUP_DIR: '../../../../resinArts/backups/resinArts',

    // The old products had no sizes at all; the new model needs every product
    // to have one variant with one size pointing at a SizeMaster entry.
    // 01-setup.js creates this SizeMaster and allows it on the vendor's plan.
    SIZE_MASTER_NAME: 'Standard',
    SIZE_LABEL_VALUE: 'Standard',
    SIZE_NAME: 'Standard',

    // The new product rules need at least one colour on every product.
    DEFAULT_COLOR: 'Standard',

    // Codes only exist in the new system, so they are generated here from the
    // product's position in the backup (oldest first): RA-00001,
    // RA-00001-V1, RA-00001-V1-S1 and the sku RA-00001-S1.
    CODE_PREFIX: 'RA',
    CODE_PAD_LENGTH: 5,

    // An old tier meant "this quantity AND ABOVE". The new tier needs an upper
    // limit, so the last tier is closed with this quantity (the new cart keeps
    // applying the last tier above its maximum anyway - utils/bulkPricing.js).
    LAST_TIER_MAXIMUM_QUANTITY: 9999,

    // The old database kept one free-text address per customer. The new
    // Address needs a name, room number and building as well, which the old
    // data cannot supply - the whole old text goes into address_in_words.
    ADDRESS_NAME: 'Home',
    ADDRESS_ROOM_NO_PLACEHOLDER: 'N/A',
    ADDRESS_BUILDING_PLACEHOLDER: 'N/A',

    // resinArts only ever sold within India and stored no country.
    COUNTRY_SHORT_NAME: 'IN',

    // The new store needs a state on every customer. An old customer who never
    // filled one in is given this state (a name from lib/indiaLocations.js).
    DEFAULT_STATE_NAME: 'Maharashtra',

    // Stamped on every migrated product / variant / size (the app itself
    // writes MANUAL, CLONED ... here).
    REMARKS: 'MIGRATED_FROM_RESINARTS',

    // 07-companySettings: new policy field <- the old field(s) it is built
    // from. The old store kept "return" and "refund" as two policies, the new
    // one has a single "return and refund" policy: they are joined in this
    // order, and a source with a heading gets that heading above its text
    // (the old refund policy has no title of its own). The new store's
    // cancelPolicy has no old counterpart and is left alone.
    POLICY_FIELDS: {
        privacyPolicy: [{ field: 'privacyPolicy' }],
        termsAndConditions: [{ field: 'termsAndConditions' }],
        aboutUs: [{ field: 'aboutUs' }],
        shippingPolicy: [{ field: 'shippingPolicy' }],
        returnRefundPolicy: [
            { field: 'returnPolicy' },
            { field: 'refundPolicy', heading: 'Refund Policy' }
        ]
    }
};
