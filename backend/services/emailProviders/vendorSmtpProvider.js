const nodemailer = require('nodemailer');
const common = require('../../utils/common');

/*
|--------------------------------------------------------------------------
| VENDOR'S OWN SMTP ACCOUNT
|--------------------------------------------------------------------------
| Every vendor sends through their own email account (Company Settings >
| Email > "Your email account" - e.g. Gmail with an App Password), never the
| platform's. The password is stored encrypted (common.encryptSecret, the
| same CREDENTIALS_ENCRYPTION_KEY mechanism as the payment-gateway
| credentials) and only decrypted here, when connecting.
|
| One pooled connection per vendor is kept and reused; it's rebuilt when the
| account's settings change (the signature below).
*/

const CONNECTION_TIMEOUT_MS = 15000;

// SSL = implicit TLS (usually port 465); STARTTLS = upgrade after connecting
// (usually 587); NONE = no encryption (only for trusted/internal servers).
const buildTransportOptions = (account, password) => ({
    host: account.host,
    port: Number(account.port),
    secure: account.security === 'SSL',
    requireTLS: account.security === 'STARTTLS',
    ignoreTLS: account.security === 'NONE',
    auth: { user: account.username, pass: password },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: 60000
});

const transporters = new Map(); // vendorId -> { signature, transporter }

const signatureOf = (account) =>
    [account.host, account.port, account.security, account.username, account.encryptedPassword].join('|');

const getTransporter = (vendorId, account) => {
    const key = String(vendorId);
    const signature = signatureOf(account);
    const cached = transporters.get(key);
    if (cached && cached.signature === signature) return cached.transporter;
    if (cached) cached.transporter.close();

    const transporter = nodemailer.createTransport({
        ...buildTransportOptions(account, common.decryptSecret(account.encryptedPassword)),
        pool: true,
        maxConnections: 2
    });
    transporters.set(key, { signature, transporter });
    return transporter;
};

// Drops a vendor's pooled connection (their account changed or was removed).
const forgetVendor = (vendorId) => {
    const cached = transporters.get(String(vendorId));
    if (cached) cached.transporter.close();
    transporters.delete(String(vendorId));
};

// Checks the server accepts these details - signs in without sending anything.
// password: the plain password to try. Throws the server's error when it fails.
const verifyAccount = async (account, password) => {
    const transporter = nodemailer.createTransport(buildTransportOptions(account, password));
    try {
        await transporter.verify();
    } finally {
        transporter.close();
    }
};

const toNodemailerAttachment = (file) => ({
    filename: file.filename,
    content: file.content,
    contentType: file.mimeType,
    cid: file.cid || undefined
});

// payload -> { messageId }
const send = async (vendorId, account, { from, to, cc, bcc, subject, text, html, attachments }) => {
    const info = await getTransporter(vendorId, account).sendMail({
        from,
        to,
        cc: cc && cc.length ? cc : undefined,
        bcc: bcc && bcc.length ? bcc : undefined,
        subject,
        text,
        html,
        attachments: (attachments || []).map(toNodemailerAttachment)
    });
    return { messageId: info.messageId };
};

// '"Acme Store" <shop@acme.com>' - the From every email of the vendor uses.
const formatFrom = (account) => {
    const address = account.fromEmail || account.username;
    if (!account.fromName) return address;
    return `"${String(account.fromName).replace(/"/g, "'")}" <${address}>`;
};

// Whether a vendor's saved account is complete enough to send with.
const isAccountReady = (account) => !!(account && account.host && account.port && account.username && account.encryptedPassword);

module.exports = {
    send,
    verifyAccount,
    forgetVendor,
    formatFrom,
    isAccountReady
};
