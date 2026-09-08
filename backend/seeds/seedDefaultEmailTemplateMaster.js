require('dotenv').config();
const mongoose = require('mongoose');

const DefaultEmailTemplateMaster = require('../models/DefaultEmailTemplateMaster');
const { EMAIL_MODULES } = require('../constants/emailModuleConstants');

async function seedDefaultEmailTemplateMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const orderTemplate = await DefaultEmailTemplateMaster.findOneAndUpdate(
            { module: EMAIL_MODULES.ORDER },
            {
                module: EMAIL_MODULES.ORDER,
                subject: 'Update on your order {{orderNumber}}',
                htmlBody: '<p>Hi {{customerName}},</p><p>Your order {{orderNumber}} is now <strong>{{stepName}}</strong>.</p><p>{{remarks}}</p>',
                textBody: 'Hi {{customerName}}, your order {{orderNumber}} is now {{stepName}}. {{remarks}}',
                status: 'A'
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log('DefaultEmailTemplateMaster seeded successfully.');
        console.log(orderTemplate);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedDefaultEmailTemplateMaster();
