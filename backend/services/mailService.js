const axios = require('axios');

const RESEND_EMAIL_API_URL = 'https://api.resend.com/emails';

/**
 * Sends a direct branded email using Resend's REST API.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} htmlContent - Responsive HTML content with brand styling.
 * @param {string} senderType - 'onboarding' or 'system' identity.
 */
const sendDirectBrandMail = async (to, subject, htmlContent, senderType = 'system') => {
  const fromEmail = senderType === 'onboarding'
    ? 'Yogi Desk AI <support@yogidesk-ai.com>'
    : 'Yogi Desk AI <no-reply@yogidesk-ai.com>';

  try {
    await axios.post(RESEND_EMAIL_API_URL, {
      from: fromEmail,
      to: [to],
      subject,
      html: htmlContent,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
  } catch (err) {
    console.error("Axios Resend REST API Error:", err.response?.data || err.message);
  }
};

module.exports = { sendDirectBrandMail };
