// Assigns the Free Cash Usage module to ONE vendor's CompanyMaster.
// The module also needs isFreeCashFeatureOn to be on in WebsiteMaster AND in
// the vendor's CompanyMaster - this script does not change those flags, it
// only tells you (exit code 2) when one of them is off.
// Run seeds/seedModuleMaster.js first so the module exists. Safe to re-run.
// Restart the backend afterwards if Redis is off (the vendor data is cached
// in memory), or clear the vendor's company-master / module-master Redis keys
// if it is on.
//   node scripts/enableFreeCashUsageForVendor.js <vendorId>
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const ModuleMaster = require('../models/ModuleMaster');
const CompanyMaster = require('../models/CompanyMaster');
const WebsiteMaster = require('../models/WebsiteMaster');

const MODULE_CODE = 'FREE_CASH_USAGE';
const FLAG = 'isFreeCashFeatureOn';

async function enableFreeCashUsageForVendor() {
    try {
        const vendorId = process.argv[2];
        if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
            throw new Error('Usage: node scripts/enableFreeCashUsageForVendor.js <vendorId>');
        }

        await mongoose.connect(process.env.MONGODB_URI);

        const module = await ModuleMaster.findOne({ code: MODULE_CODE, status: 'A' });
        if (!module) {
            throw new Error(`Module ${MODULE_CODE} not found - run seeds/seedModuleMaster.js first.`);
        }

        const company = await CompanyMaster.findOne({ vendorId });
        if (!company) {
            throw new Error(`No CompanyMaster found for vendor ${vendorId}.`);
        }

        // At most one entry per moduleId - re-assigning overwrites it and clears revokedAt.
        const now = new Date();
        const entry = { moduleId: module._id, startDate: now, expiryDate: null, assignedAt: now, revokedAt: null };
        const existingIndex = company.assignedModules.findIndex((m) => m.moduleId.toString() === module._id.toString());
        if (existingIndex >= 0) {
            company.assignedModules[existingIndex] = entry;
        } else {
            company.assignedModules.push(entry);
        }
        await company.save();

        const website = await WebsiteMaster.findOne({}).select(FLAG).lean();
        if (!website || website[FLAG] !== true || company[FLAG] !== true) {
            process.stderr.write(`Module assigned, but ${FLAG} is off in WebsiteMaster or this vendor's CompanyMaster - the module stays hidden until both are on.\n`);
            process.exit(2);
        }

        process.exit(0);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
    }
}

enableFreeCashUsageForVendor();
