const nodemailerProvider = require('./nodemailerProvider');
const sendgridProvider = require('./sendgridProvider');
const sesProvider = require('./sesProvider');

const providers = {
    nodemailer: nodemailerProvider,
    sendgrid: sendgridProvider,
    ses: sesProvider
};

// Every provider adapter implements the same interface:
//   send({ from, to, cc, bcc, subject, text, html, attachments }) -> Promise<{ messageId }>
const getProvider = (providerName) => {
    const provider = providers[providerName];
    if (!provider) {
        throw new Error(`Unsupported email provider: ${providerName}`);
    }
    return provider;
};

module.exports = {
    getProvider
};
