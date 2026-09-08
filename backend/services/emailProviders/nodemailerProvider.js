const nodemailer = require('nodemailer');
const emailProviderConfig = require('../../config/emailProviderConfig');

const { host, port, secure, user, pass } = emailProviderConfig.nodemailer;

// Created lazily (not at require-time) so a missing SMTP config doesn't
// crash the process on boot - it only surfaces when this provider is
// actually used to send.
let transporter = null;
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host,
            port: Number(port),
            secure,
            auth: { user, pass }
        });
    }
    return transporter;
};

// attachments/images arrive in the generic shape emailService.js builds:
// { filename, content: Buffer, mimeType, cid? } - cid present means it's
// meant to be embedded inline (referenced as <img src="cid:...">) rather
// than shown as a downloadable attachment.
const toNodemailerAttachment = (file) => ({
    filename: file.filename,
    content: file.content,
    contentType: file.mimeType,
    cid: file.cid || undefined
});

// payload -> { messageId }
const send = async ({ from, to, cc, bcc, subject, text, html, attachments }) => {
    const info = await getTransporter().sendMail({
        from,
        to,
        cc: cc && cc.length ? cc : undefined,
        bcc: bcc && bcc.length ? bcc : undefined,
        subject,
        text,
        html,
        attachments: attachments && attachments.length ? attachments.map(toNodemailerAttachment) : undefined
    });
    return { messageId: info.messageId };
};

module.exports = {
    send
};
