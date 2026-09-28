require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const DefaultEmailTemplateMaster = require('../models/DefaultEmailTemplateMaster');
const { EMAIL_MODULES } = require('../constants/emailModuleConstants');

async function seedDefaultEmailTemplateMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // One platform default per module - sent when the vendor has no
        // template of their own for it (and CompanySettings.useDefaultEmailTemplate
        // is on). Re-running the seed updates them in place.
        const defaults = [
            {
                module: EMAIL_MODULES.ORDER,
                subject: 'Update on your order {{orderNumber}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>Your order {{orderNumber}} is now <strong>{{stepName}}</strong>.</p><p>{{remarks}}</p>',
                textBody: 'Hi {{customerName}}, your order {{orderNumber}} is now {{stepName}}. {{remarks}}'
            },
            {
                module: EMAIL_MODULES.DELIVERY_AGENT_ASSIGNED,
                subject: 'A delivery agent has been assigned to your order {{orderNumber}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>{{agentName}} ({{agentPhone}}) will deliver your order {{orderNumber}} on <strong>{{deliveryDate}}</strong>.</p>',
                textBody: 'Hi {{customerName}}, {{agentName}} ({{agentPhone}}) will deliver your order {{orderNumber}} on {{deliveryDate}}.'
            },
            {
                module: EMAIL_MODULES.DELIVERY_AGENT_CHANGED,
                subject: 'Your delivery agent for order {{orderNumber}} has changed',
                htmlBody: '<p>Hi {{customerName}},</p><p>Your order {{orderNumber}} will now be delivered by {{agentName}} ({{agentPhone}}) on <strong>{{deliveryDate}}</strong>.</p>',
                textBody: 'Hi {{customerName}}, your order {{orderNumber}} will now be delivered by {{agentName}} ({{agentPhone}}) on {{deliveryDate}}.'
            },
            {
                module: EMAIL_MODULES.DELIVERY_AGENT_UNASSIGNED,
                subject: 'Update on the delivery of your order {{orderNumber}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>{{agentName}} is no longer delivering your order {{orderNumber}}. We will let you know as soon as a new delivery agent is assigned.</p>',
                textBody: 'Hi {{customerName}}, {{agentName}} is no longer delivering your order {{orderNumber}}. We will let you know as soon as a new delivery agent is assigned.'
            },
            {
                module: EMAIL_MODULES.DELIVERY_DATE_CHANGED,
                subject: 'New delivery date for your order {{orderNumber}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>The delivery date of your order {{orderNumber}} has changed from {{previousDeliveryDate}} to <strong>{{deliveryDate}}</strong>.</p>',
                textBody: 'Hi {{customerName}}, the delivery date of your order {{orderNumber}} has changed from {{previousDeliveryDate}} to {{deliveryDate}}.'
            },
            {
                module: EMAIL_MODULES.COURIER_ASSIGNED,
                subject: 'Your order {{orderNumber}} will be shipped with {{courierName}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>Your order {{orderNumber}} will be shipped with <strong>{{courierName}}</strong>. Your tracking number is <strong>{{trackingNumber}}</strong>.</p>',
                textBody: 'Hi {{customerName}}, your order {{orderNumber}} will be shipped with {{courierName}}. Your tracking number is {{trackingNumber}}.'
            },
            {
                module: EMAIL_MODULES.COURIER_CHANGED,
                subject: 'The courier for your order {{orderNumber}} has changed',
                htmlBody: '<p>Hi {{customerName}},</p><p>Your order {{orderNumber}} will now be shipped with <strong>{{courierName}}</strong> instead of {{previousCourierName}}. Your tracking number is <strong>{{trackingNumber}}</strong>.</p>',
                textBody: 'Hi {{customerName}}, your order {{orderNumber}} will now be shipped with {{courierName}} instead of {{previousCourierName}}. Your tracking number is {{trackingNumber}}.'
            },
            {
                module: EMAIL_MODULES.COURIER_REMOVED,
                subject: 'Update on the shipping of your order {{orderNumber}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>Your order {{orderNumber}} will no longer be shipped with {{courierName}}. We will let you know how it will be delivered as soon as possible.</p>',
                textBody: 'Hi {{customerName}}, your order {{orderNumber}} will no longer be shipped with {{courierName}}. We will let you know how it will be delivered as soon as possible.'
            }
        ];

        for (const template of defaults) {
            await DefaultEmailTemplateMaster.findOneAndUpdate(
                { module: template.module },
                { ...template, status: 'A' },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        console.log('DefaultEmailTemplateMaster seeded successfully.');
        console.log(`Seeded ${defaults.length} default templates: ${defaults.map((t) => t.module).join(', ')}`);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedDefaultEmailTemplateMaster();
