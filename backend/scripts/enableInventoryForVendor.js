// Turns the Inventory module and the low stock alert feature on for ONE vendor:
//   1. assigns the INVENTORY module to the vendor's CompanyMaster
//   2. sets CompanyMaster.isReceivingLowStockAlertFeatureOn = true
//   3. sets WebsiteMaster.isReceivingLowStockAlertFeatureOn = true (global switch)
// The vendor then switches the alert on and sets the threshold themselves in
// Company Settings > Product. Run seeds/seedModuleMaster.js first so the
// module exists. Safe to re-run. Restart the backend afterwards if Redis is
// off (the vendor data is cached in memory), or clear the vendor's
// company-master / website-master Redis keys if it is on.
//   node scripts/enableInventoryForVendor.js <vendorId>
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const ModuleMaster = require('../models/ModuleMaster');
const CompanyMaster = require('../models/CompanyMaster');
const WebsiteMaster = require('../models/WebsiteMaster');

const MODULE_CODE = 'INVENTORY';
const FLAG = 'isReceivingLowStockAlertFeatureOn';

async function enableInventoryForVendor() {
    try {
        const vendorId = process.argv[2];
        if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
            throw new Error('Usage: node scripts/enableInventoryForVendor.js <vendorId>');
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

        await WebsiteMaster.updateMany({}, { $set: { [FLAG]: true } });

        process.exit(0);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
    }
}

enableInventoryForVendor();
