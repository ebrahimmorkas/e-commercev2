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
            },
            {
                module: EMAIL_MODULES.DISCOUNT_AVAILABLE,
                subject: 'New offer for you: {{discountName}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>Enjoy <strong>{{discountValue}} off</strong> with {{discountName}} on {{appliesTo}}, from {{startDate}} until {{endDate}}.</p><p>{{discountDescription}}</p><p>Coupon code: <strong>{{couponCode}}</strong></p>',
                textBody: 'Hi {{customerName}}, enjoy {{discountValue}} off with {{discountName}} on {{appliesTo}}, from {{startDate}} until {{endDate}}. {{discountDescription}} Coupon code: {{couponCode}}'
            },
            {
                module: EMAIL_MODULES.DISCOUNT_EXPIRING_SOON,
                subject: '{{discountName}} ends on {{endDate}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>Hurry! <strong>{{discountValue}} off</strong> with {{discountName}} ends on <strong>{{endDate}}</strong>.</p><p>Coupon code: <strong>{{couponCode}}</strong></p>',
                textBody: 'Hi {{customerName}}, hurry! {{discountValue}} off with {{discountName}} ends on {{endDate}}. Coupon code: {{couponCode}}'
            },
            {
                module: EMAIL_MODULES.FREE_CASH_CREDITED,
                subject: 'You have received {{freeCashAmount}} Free Cash',
                htmlBody: '<p>Hi {{customerName}},</p><p><strong>{{freeCashAmount}}</strong> Free Cash ({{freeCashName}}) has been added to your account. Use it on orders from {{startDate}} until {{endDate}}.</p>',
                textBody: 'Hi {{customerName}}, {{freeCashAmount}} Free Cash ({{freeCashName}}) has been added to your account. Use it on orders from {{startDate}} until {{endDate}}.'
            },
            {
                module: EMAIL_MODULES.FREE_CASH_USED,
                subject: 'You used {{amountUsed}} Free Cash on order {{orderNumber}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>You used <strong>{{amountUsed}}</strong> of your {{freeCashName}} Free Cash on order {{orderNumber}}. Remaining: <strong>{{remainingAmount}}</strong>.</p>',
                textBody: 'Hi {{customerName}}, you used {{amountUsed}} of your {{freeCashName}} Free Cash on order {{orderNumber}}. Remaining: {{remainingAmount}}.'
            },
            {
                module: EMAIL_MODULES.FREE_CASH_REFUNDED,
                subject: '{{amountRefunded}} Free Cash is back in your account',
                htmlBody: '<p>Hi {{customerName}},</p><p><strong>{{amountRefunded}}</strong> of your {{freeCashName}} Free Cash from order {{orderNumber}} has been given back. Available now: <strong>{{remainingAmount}}</strong>.</p>',
                textBody: 'Hi {{customerName}}, {{amountRefunded}} of your {{freeCashName}} Free Cash from order {{orderNumber}} has been given back. Available now: {{remainingAmount}}.'
            },
            {
                module: EMAIL_MODULES.FREE_CASH_REVOKED,
                subject: 'Your {{freeCashName}} Free Cash has been withdrawn',
                htmlBody: '<p>Hi {{customerName}},</p><p>Your {{freeCashName}} Free Cash of {{freeCashAmount}} has been withdrawn and can no longer be used.</p>',
                textBody: 'Hi {{customerName}}, your {{freeCashName}} Free Cash of {{freeCashAmount}} has been withdrawn and can no longer be used.'
            },
            {
                module: EMAIL_MODULES.FREE_CASH_EXPIRED,
                subject: 'Your {{freeCashName}} Free Cash has been replaced',
                htmlBody: '<p>Hi {{customerName}},</p><p>Your {{freeCashName}} Free Cash has expired because new Free Cash was added to your account.</p>',
                textBody: 'Hi {{customerName}}, your {{freeCashName}} Free Cash has expired because new Free Cash was added to your account.'
            },
            {
                module: EMAIL_MODULES.FREE_CASH_EXPIRING_SOON,
                subject: 'Your Free Cash expires on {{endDate}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>You still have <strong>{{remainingAmount}}</strong> of {{freeCashName}} Free Cash. Use it before <strong>{{endDate}}</strong>.</p>',
                textBody: 'Hi {{customerName}}, you still have {{remainingAmount}} of {{freeCashName}} Free Cash. Use it before {{endDate}}.'
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
