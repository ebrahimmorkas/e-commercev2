// Turns the Admin Place Order feature on for ONE vendor:
//   1. assigns the ADMIN_PLACE_ORDER module to the vendor's CompanyMaster
//   2. sets CompanyMaster.isAdminPlacingOrderOnBehalfOfUserIsOn = true
//   3. sets WebsiteMaster.isAdminPlacingOrderOnBehalfOfUserIsOn = true (global switch)
// Run seeds/seedModuleMaster.js first so the module exists. Safe to re-run.
//   node scripts/enableAdminPlaceOrderForVendor.js <vendorId>
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const ModuleMaster = require('../models/ModuleMaster');
const CompanyMaster = require('../models/CompanyMaster');
const WebsiteMaster = require('../models/WebsiteMaster');

const MODULE_CODE = 'ADMIN_PLACE_ORDER';
const FLAG = 'isAdminPlacingOrderOnBehalfOfUserIsOn';

async function enableAdminPlaceOrderForVendor() {
    try {
        const vendorId = process.argv[2];
        if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
            throw new Error('Usage: node scripts/enableAdminPlaceOrderForVendor.js <vendorId>');
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
        company[FLAG] = true;
        await company.save();
        console.log(`CompanyMaster ${company._id}: module assigned, ${FLAG}=true`);

        const websiteResult = await WebsiteMaster.updateMany({}, { $set: { [FLAG]: true } });
        console.log(`WebsiteMaster: ${FLAG}=true on ${websiteResult.matchedCount} document(s)`);

        process.exit(0);
    } catch (error) {
        console.error(error.message || error);
        process.exit(1);
    }
}

enableAdminPlaceOrderForVendor();
