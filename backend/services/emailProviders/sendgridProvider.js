const sgMail = require('@sendgrid/mail');
const emailProviderConfig = require('../../config/emailProviderConfig');

sgMail.setApiKey(emailProviderConfig.sendgrid.apiKey);

// attachments/images arrive in the generic shape emailService.js builds:
// { filename, content: Buffer, mimeType, cid? } - cid present means it's
// meant to be embedded inline (referenced as <img src="cid:...">) rather
// than shown as a downloadable attachment. SendGrid needs base64 content
// and content_id/disposition instead of nodemailer's cid.
const toSendgridAttachment = (file) => ({
    content: Buffer.isBuffer(file.content) ? file.content.toString('base64') : file.content,
    filename: file.filename,
    type: file.mimeType,
    disposition: file.cid ? 'inline' : 'attachment',
    content_id: file.cid || undefined
});

// payload -> { messageId }
const send = async ({ from, to, cc, bcc, subject, text, html, attachments }) => {
    const msg = {
        from,
        to,
        cc: cc && cc.length ? cc : undefined,
        bcc: bcc && bcc.length ? bcc : undefined,
        subject,
        text,
        html,
        attachments: attachments && attachments.length ? attachments.map(toSendgridAttachment) : undefined
    };

    const [response] = await sgMail.send(msg);
    return { messageId: response.headers['x-message-id'] || null };
};

module.exports = {
    send
};
