const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, '../reports');
const MAX_LINES_PRINTED = 60;

// Outcomes that mean "this record is (or would be) in the new database".
const MIGRATED_OUTCOMES = ['inserted', 'replaced', 'would-insert', 'would-replace'];

// Collects what happened to every record of one script run, prints a summary,
// and saves the full list as JSON (reports/ is git-ignored - it holds
// customer names and emails).
const createReport = (scriptName, isApply) => {
    const entries = [];

    const add = (section, outcome, label, reason = null) => {
        try {
            entries.push({ section, outcome, label, reason });
        } catch (err) {
            throw err;
        }
    };

    const countMigrated = (section) => {
        try {
            return entries.filter(e => e.section === section && MIGRATED_OUTCOMES.includes(e.outcome)).length;
        } catch (err) {
            throw err;
        }
    };

    const print = () => {
        try {
            const sections = [...new Set(entries.map(e => e.section))];

            for (const section of sections) {
                const sectionEntries = entries.filter(e => e.section === section);
                const counts = {};
                for (const entry of sectionEntries) {
                    counts[entry.outcome] = (counts[entry.outcome] || 0) + 1;
                }

                console.log(`\n${section}: ${sectionEntries.length} record(s)`);
                for (const [outcome, count] of Object.entries(counts)) {
                    console.log(`  ${outcome.padEnd(14)} ${count}`);
                }

                const notable = sectionEntries.filter(e => e.reason);
                if (notable.length > 0) {
                    console.log(`  --- details (${notable.length}) ---`);
                    for (const entry of notable.slice(0, MAX_LINES_PRINTED)) {
                        console.log(`  [${entry.outcome}] ${entry.label} - ${entry.reason}`);
                    }
                    if (notable.length > MAX_LINES_PRINTED) {
                        console.log(`  ... ${notable.length - MAX_LINES_PRINTED} more in the report file`);
                    }
                }
            }
        } catch (err) {
            throw err;
        }
    };

    const save = () => {
        try {
            fs.mkdirSync(REPORTS_DIR, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filePath = path.join(REPORTS_DIR, `${scriptName}-${isApply ? 'apply' : 'dry-run'}-${stamp}.json`);
            fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
            console.log(`\nFull report: ${filePath}`);
        } catch (err) {
            throw err;
        }
    };

    return { add, countMigrated, print, save };
};

module.exports = {
    createReport
};
