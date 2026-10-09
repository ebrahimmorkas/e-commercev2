require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const ModuleMaster = require('../models/ModuleMaster');
const CompanyMaster = require('../models/CompanyMaster');
const { getModuleFeatureFlags } = require('../services/moduleMasterService');

// One-time (but safe to re-run - it never touches an existing assignedModules
// entry, only adds missing ones) migration: run this after seedModuleMaster.js
// so every vendor created before the Module Master feature existed doesn't
// get locked out by checkModuleAssigned. A system module is granted to every
// vendor unconditionally; a non-system module is granted only if the vendor
// already has its corresponding CompanyMaster feature flag turned on, so no
// one loses access to something they're already using.

async function backfillAssignedModules() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const modules = await ModuleMaster.find({ status: 'A' });
        if (modules.length === 0) {
            process.exit(0);
        }

        const companies = await CompanyMaster.find({});
        const now = new Date();

        for (const company of companies) {
            const existingModuleIds = new Set(
                (company.assignedModules || []).map((entry) => entry.moduleId.toString())
            );

            let changed = false;

            for (const module of modules) {
                if (existingModuleIds.has(module._id.toString())) continue;

                // Every flag the module needs must be on for this vendor.
                const featureFlags = getModuleFeatureFlags(module.code);
                const shouldAssign = module.isSystemModule || (featureFlags.length > 0 && featureFlags.every((flag) => company[flag] === true));

                if (!shouldAssign) continue;

                company.assignedModules.push({
                    moduleId: module._id,
                    startDate: now,
                    expiryDate: null,
                    assignedAt: now,
                    revokedAt: null
                });
                changed = true;
            }

            if (changed) {
                await company.save();
            }
        }


        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

backfillAssignedModules();
