// Manual/scheduled entry point for emailService.retryFailedEmails - this
// file does no automatic scheduling itself. Run it by hand (`node
// scripts/retryFailedEmails.js`), or point a cron job / node-cron / your
// host's scheduler at this command on whatever interval you decide.
require('dotenv').config();
const mongoose = require('mongoose');
const emailService = require('../services/emailService');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const result = await emailService.retryFailedEmails({});

        console.log(result.message);
        console.log(result.meta.results);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
