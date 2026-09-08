// Single source of truth for all email-provider credentials.
// One set of credentials per provider, read from .env (see .env.example).
// Which provider a given send actually uses is resolved per-vendor at
// runtime (see resolveEmailProvider in services/emailService.js) - these
// are just the infra credentials behind each provider name.

const emailProviderConfig = {
    nodemailer: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY
    },
    ses: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_SES_REGION || process.env.AWS_REGION
    }
};

module.exports = emailProviderConfig;
