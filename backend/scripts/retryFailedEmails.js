// Manual/scheduled entry point for emailService.retryFailedEmails - this
// file does no automatic scheduling itself. Run it by hand (`node
// scripts/retryFailedEmails.js`), or point a cron job / node-cron / your
// host's scheduler at this command on whatever interval you decide.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const emailService = require('../services/emailService');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const result = await emailService.retryFailedEmails({});


        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

run();
