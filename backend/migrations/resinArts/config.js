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

    // Stamped on every migrated product / variant / size (the app itself
    // writes MANUAL, CLONED ... here).
    REMARKS: 'MIGRATED_FROM_RESINARTS'
};
