require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const ModuleMaster = require('../models/ModuleMaster');
const CompanyMaster = require('../models/CompanyMaster');

// Assigns EVERY active module to one vendor (SEED_VENDOR_ID). backfillAssignedModules.js only
// grants system modules and modules whose feature flag is already on, so modules with no flag
// (e.g. PRODUCTS, ADD_USER) are never assigned by it. Safe to re-run: existing entries are
// left alone, a revoked or expired one is re-activated.
//
// NOTE: this only assigns the modules. A gated feature still needs its flag on in BOTH
// WebsiteMaster and this vendor's CompanyMaster (see checkFeatureOnOrOff).

async function assignAllModulesToVendor() {
    try {
        if (!process.env.SEED_VENDOR_ID) {
            console.log('Set SEED_VENDOR_ID to the vendor _id first.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);

        const vendorId = new mongoose.Types.ObjectId(process.env.SEED_VENDOR_ID);
        const company = await CompanyMaster.findOne({ vendorId });
        if (!company) {
            console.log('No CompanyMaster found for that vendor - run seedCompanyMaster.js first.');
            process.exit(1);
        }

        const modules = await ModuleMaster.find({ status: 'A' });
        const now = new Date();
        let changed = 0;

        for (const module of modules) {
            const existing = (company.assignedModules || []).find(
                (entry) => entry.moduleId.toString() === module._id.toString()
            );

            if (!existing) {
                company.assignedModules.push({
                    moduleId: module._id,
                    startDate: now,
                    expiryDate: null,
                    assignedAt: now,
                    revokedAt: null
                });
                changed++;
            } else if (existing.revokedAt || existing.expiryDate) {
                existing.revokedAt = null;
                existing.expiryDate = null;
                changed++;
            }
        }

        if (changed) await company.save();

        console.log(`Done. ${changed} module(s) assigned or re-activated, ${modules.length} active modules in total.`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

assignAllModulesToVendor();
