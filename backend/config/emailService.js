const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendCustomYogiMail = async (to, subject, htmlBody) => {
    return await resend.emails.send({
        from: 'Yogi Desk AI <support@yourdomain.com>',
        to,
        subject,
        html: htmlBody
    });
};

module.exports = { sendCustomYogiMail };