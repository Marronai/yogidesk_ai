const axios = require('axios');

const BREVO_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email';

const sendDirectBrandMail = async (to, subject, htmlContent, senderType = 'system') => {
  const fromEmail = senderType === 'onboarding'
    ? 'support@yogidesk-ai.com'
    : 'no-reply@yogidesk-ai.com';

  try {
    await axios.post(BREVO_EMAIL_API_URL, {
      sender: { name: 'Yogi Desk AI', email: fromEmail },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    console.log(`Brevo mail successfully sent to ${to} via ${fromEmail}`);
  } catch (err) {
    console.error("Brevo REST API Failure:", err.response?.data || err.message);
  }
};

module.exports = { sendDirectBrandMail };
