const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const emailProviderConfig = require('../../config/emailProviderConfig');

const { accessKeyId, secretAccessKey, region } = emailProviderConfig.ses;

const client = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey }
});

// Note: SES's "Simple" content type used here does not support attachments
// or inline images (that needs raw MIME content instead). emailService.js
// rejects a send before it ever reaches this provider when the resolved
// provider is 'ses' and attachments/images were supplied - see the SES
// guard in sendEmail(). Use nodemailer or sendgrid for emails that need them.
// payload -> { messageId }
const send = async ({ from, to, cc, bcc, subject, text, html }) => {
    const command = new SendEmailCommand({
        FromEmailAddress: from,
        Destination: {
            ToAddresses: to,
            CcAddresses: cc && cc.length ? cc : undefined,
            BccAddresses: bcc && bcc.length ? bcc : undefined
        },
        Content: {
            Simple: {
                Subject: { Data: subject },
                Body: {
                    ...(html ? { Html: { Data: html } } : {}),
                    ...(text ? { Text: { Data: text } } : {})
                }
            }
        }
    });

    const result = await client.send(command);
    return { messageId: result.MessageId };
};

module.exports = {
    send
};
