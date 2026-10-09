// The platform owner's tool for order workflows (OrderStepMaster templates)
// and for giving one to a vendor (CompanyMaster.orderSteps). There is no HTTP
// endpoint for this - same convention as WebsiteMaster/CompanyMaster.
//
// A template is the NORMAL flow of an order, in order. Use any of the
// built-in codes (ACCEPTED, READY_FOR_DELIVERY, DISPATCHED, DELIVERED,
// COMPLETED - none is required) and/or your own codes (e.g. IN_PROGRESS,
// CONFIRMED). The last step is final. REJECTED, CANCELLED, REFUNDED and
// PAYMENT_AT_DELIVERY are built-in side steps and must NOT be listed.
// Sequence = position in --steps (1, 2, 3, ...).
//
// A template is never edited once created (orders keep following the one
// they were placed on) - create a new one and assign it instead.
//
// Usage:
//   node scripts/manageOrderStepTemplate.js list
//   node scripts/manageOrderStepTemplate.js create --name="<template name>" --steps="CODE:Name,CODE:Name,..." [--domain=<vendor domain> | --vendorId=<id>]
//   node scripts/manageOrderStepTemplate.js assign <templateId> (--domain=<vendor domain> | --vendorId=<id>)
//
// Example:
//   node scripts/manageOrderStepTemplate.js create --name="Confirm-then-ship flow" --steps="IN_PROGRESS:In Progress,ACCEPTED:Accept,CONFIRMED:Confirm,READY_FOR_DELIVERY:Ready for delivery,DISPATCHED:Dispatched,DELIVERED:Delivered,COMPLETED:Completed" --domain=localhost
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const OrderStepMaster = require('../models/OrderStepMaster');
const CompanyMaster = require('../models/CompanyMaster');
const CompanySettings = require('../models/CompanySettings');
const Vendor = require('../models/Vendor');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const { connectRedis } = require('../config/redisConfig');
const { TEMPLATE_FORBIDDEN_CODES } = require('../constants/orderStepConstants');

const STEP_CODE_PATTERN = /^[A-Z0-9_]{1,50}$/;

const parseArgs = (argv) => {
    try {
        const result = { _: [] };
        for (const arg of argv) {
            if (arg.startsWith('--')) {
                const eq = arg.indexOf('=');
                if (eq === -1) {
                    result[arg.slice(2)] = true;
                } else {
                    result[arg.slice(2, eq)] = arg.slice(eq + 1);
                }
            } else {
                result._.push(arg);
            }
        }
        return result;
    } catch (err) {
        throw err;
    }
};

// "CODE:Name,CODE:Name" -> [{ code, name, sequence, requiresManualUpdation }], or { error }.
const parseSteps = (stepsArg) => {
    try {
        if (!stepsArg || typeof stepsArg !== 'string') {
            return { error: 'Pass the steps as --steps="CODE:Name,CODE:Name,..."' };
        }
        const steps = [];
        const parts = stepsArg.split(',').map((part) => part.trim()).filter(Boolean);
        for (const part of parts) {
            const colon = part.indexOf(':');
            if (colon === -1) {
                return { error: `"${part}" must look like CODE:Name` };
            }
            const code = part.slice(0, colon).trim().toUpperCase();
            const name = part.slice(colon + 1).trim();
            if (!STEP_CODE_PATTERN.test(code)) {
                return { error: `"${code}" is not a valid code - use letters, digits and underscores only.` };
            }
            if (TEMPLATE_FORBIDDEN_CODES.includes(code)) {
                return { error: `"${code}" is a built-in side step and can't be part of a template.` };
            }
            if (!name || name.length > 100) {
                return { error: `The name for "${code}" must be 1-100 characters.` };
            }
            if (steps.some((step) => step.code === code)) {
                return { error: `"${code}" is listed twice.` };
            }
            steps.push({ code, name, sequence: steps.length + 1, requiresManualUpdation: false });
        }
        if (steps.length === 0) {
            return { error: 'A template needs at least one step.' };
        }
        return { steps };
    } catch (err) {
        throw err;
    }
};

const resolveVendorId = async (args) => {
    try {
        if (args.vendorId) {
            return mongoose.Types.ObjectId.isValid(args.vendorId) ? args.vendorId : null;
        }
        if (args.domain) {
            const vendor = await Vendor.findOne({ domain: args.domain });
            return vendor ? vendor._id : null;
        }
        return null;
    } catch (err) {
        throw err;
    }
};

const clearCompanyMasterCache = async (vendorId) => {
    try {
        if (process.env.IS_REDIS_SERVER_ON !== '1') return;
        await connectRedis();
        await redisService.del(redisKeys.companyMaster(vendorId));
    } catch (err) {
        throw err;
    }
};

const assignTemplateToVendor = async (template, vendorId) => {
    try {
        const updated = await CompanyMaster.findOneAndUpdate(
            { vendorId },
            { $set: { orderSteps: template._id } },
            { new: true }
        );
        if (!updated) {
            return false;
        }
        await clearCompanyMasterCache(vendorId);

        // Order step settings saved against the old workflow that don't exist in this one are ignored from now on.
        const settings = await CompanySettings.findOne({ vendorId }).lean();
        const codes = template.steps.map((step) => step.code);
        const stale = ['orderCancellationNotAllowedAfterStep', 'markPaymentCompletedAtStep', 'deliveryAgentFromStep', 'deliveryAgentToStep']
            .filter((field) => settings?.[field] && !codes.includes(settings[field]))
            .map((field) => `${field}=${settings[field]}`);
        return true;
    } catch (err) {
        throw err;
    }
};

const listTemplates = async () => {
    try {
        const templates = await OrderStepMaster.find({ status: { $ne: 'D' } }).sort({ createdAt: 1 }).lean();
        const assignments = await CompanyMaster.find({ orderSteps: { $ne: null } }).select('vendorId orderSteps').lean();
        for (const template of templates) {
            const vendors = assignments.filter((row) => row.orderSteps?.toString() === template._id.toString()).map((row) => row.vendorId.toString());
            const flow = [...template.steps].sort((a, b) => a.sequence - b.sequence).map((step) => `${step.code} (${step.name})`).join(' -> ');
        }
    } catch (err) {
        throw err;
    }
};

async function run() {
    try {
        const args = parseArgs(process.argv.slice(2));
        const [command, templateIdArg] = args._;
        if (!['list', 'create', 'assign'].includes(command)) {
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);

        if (command === 'list') {
            await listTemplates();
            process.exit(0);
        }

        if (command === 'create') {
            const name = typeof args.name === 'string' ? args.name.trim() : '';
            if (!name || name.length > 150) {
                process.exit(1);
            }
            if (await OrderStepMaster.exists({ name, status: { $ne: 'D' } })) {
                process.exit(1);
            }
            const parsed = parseSteps(args.steps);
            if (parsed.error) {
                process.exit(1);
            }

            let vendorId = null;
            if (args.domain || args.vendorId) {
                vendorId = await resolveVendorId(args);
                if (!vendorId) {
                    process.exit(1);
                }
            }

            const template = await OrderStepMaster.create({ name, steps: parsed.steps, status: 'A' });

            if (vendorId) {
                const assigned = await assignTemplateToVendor(template, vendorId);
                process.exit(assigned ? 0 : 1);
            }
            process.exit(0);
        }

        // assign
        if (!templateIdArg || !mongoose.Types.ObjectId.isValid(templateIdArg)) {
            process.exit(1);
        }
        const template = await OrderStepMaster.findOne({ _id: templateIdArg, status: 'A' });
        if (!template) {
            process.exit(1);
        }
        const vendorId = await resolveVendorId(args);
        if (!vendorId) {
            process.exit(1);
        }
        const assigned = await assignTemplateToVendor(template, vendorId);
        process.exit(assigned ? 0 : 1);
    } catch (error) {
        process.exit(1);
    }
}

run();
