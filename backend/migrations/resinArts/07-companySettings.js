// migrations/resinArts/07-companySettings.js
//
// Step 7 - the store's policies. Nothing else of the old company settings is
// migrated (contact details, shipping prices, alerts ... are set up by hand in
// the new store's Company Settings).
//
// Old -> new (the mapping itself is POLICY_FIELDS in config.js):
//   privacyPolicy                 -> privacyPolicy
//   termsAndConditions            -> termsAndConditions
//   aboutUs                       -> aboutUs
//   shippingPolicy                -> shippingPolicy
//   returnPolicy + refundPolicy   -> returnRefundPolicy (return first, then refund under its own heading)
//   (nothing)                     -> cancelPolicy stays as it is - the old store had none
//
// The old text is not copied as it was: it carried the fonts, colours and
// sizes of the sites it was pasted from. Only its structure is kept
// (lib/htmlCleaner.js), so it takes the new storefront's own look.
//
// The vendor's CompanySettings must already exist - this only fills in its
// policy fields and creates nothing.
//
//   node migrations/resinArts/07-companySettings.js --vendor localhost            (dry run)
//   node migrations/resinArts/07-companySettings.js --vendor localhost --apply
//
// Safe to re-run: a policy that already has text in the new store is left
// alone (--overwrite replaces it - including changes made since in Company Settings).

const CompanySettings = require('../../models/CompanySettings');
const redisKeys = require('../../utils/redisKeys');
const config = require('./config');
const { openContext, invalidateCache, run } = require('./lib/runtime');
const { readCollection } = require('./lib/backupReader');
const { createReport } = require('./lib/report');
const { cleanPolicyHtml } = require('./lib/htmlCleaner');

const POLICIES = 'Policies';

// The readable length of a piece of HTML - what the report shows, so a policy
// that lost its content in the clean-up is easy to spot.
const countTextCharacters = (html) => {
    try {
        return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().length;
    } catch (err) {
        throw err;
    }
};

// One new policy field from its old source field(s). Several sources are
// joined in the order given; a source with a heading gets it put above its text.
const buildPolicy = (oldSettings, sources) => {
    try {
        const parts = [];

        for (const source of sources) {
            const cleaned = cleanPolicyHtml(oldSettings[source.field]);
            if (!cleaned) continue;
            parts.push(source.heading ? `<h3>${source.heading}</h3>${cleaned}` : cleaned);
        }

        return parts.join('');
    } catch (err) {
        throw err;
    }
};

const main = async () => {
    try {
        const ctx = await openContext('07-companySettings: policies');
        const { args, vendor, vendorId, adminId, companySettingsData } = ctx;
        const report = createReport('07-companySettings', args.apply);

        if (!companySettingsData) {
            throw new Error(`Vendor "${vendor.domain}" has no Company Settings yet. Save Company Settings once in the admin panel first - this script only fills in its policies.`);
        }

        const oldRecords = readCollection(args.backupDir, 'companysettings');
        if (oldRecords.length !== 1) {
            throw new Error(`Expected exactly one record in companysettings.bson, found ${oldRecords.length}.`);
        }
        const oldSettings = oldRecords[0];

        const changes = {};

        for (const [newField, sources] of Object.entries(config.POLICY_FIELDS)) {
            const label = `${newField} <- ${sources.map(source => source.field).join(' + ')}`;
            const html = buildPolicy(oldSettings, sources);

            if (!html) {
                report.add(POLICIES, 'skipped', label, 'no text in the old data');
                continue;
            }

            const hasTextAlready = countTextCharacters(companySettingsData[newField]) > 0;
            if (hasTextAlready && !args.overwrite) {
                report.add(POLICIES, 'exists', label, 'the new store already has text here - left alone (--overwrite replaces it)');
                continue;
            }

            changes[newField] = html;
            const outcome = hasTextAlready
                ? (args.apply ? 'replaced' : 'would-replace')
                : (args.apply ? 'inserted' : 'would-insert');
            report.add(POLICIES, outcome, label, `${countTextCharacters(html)} characters of text`);
        }

        if (args.apply && Object.keys(changes).length > 0) {
            await CompanySettings.updateOne(
                { _id: companySettingsData._id, vendorId },
                { $set: { ...changes, updatedBy: { userID: adminId, vendorID: vendorId } } },
                { runValidators: true }
            );
            await invalidateCache([redisKeys.companySettings(vendorId)]);
        }

        report.print();
        report.save();

        if (args.apply && Object.keys(changes).length > 0) {
            console.log('\nRestart the backend if Redis is off - it keeps Company Settings in memory.');
        }
    } catch (err) {
        throw err;
    }
};

run(main);
