const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends a direct branded email using Resend API bypassing standard SMTP/Supabase triggers.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} htmlContent - Responsive HTML content with brand styling.
 * @param {string} senderType - 'onboarding' or 'system' identity.
 */
const sendDirectBrandMail = async (to, subject, htmlContent, senderType = 'system') => {
  try {
    const fromIdentity = senderType === 'onboarding' 
      ? 'Yogi Desk AI <support@yogidesk-ai.com>' 
      : 'Yogi Desk AI <no-reply@yogidesk-ai.com>';

    const { data, error } = await resend.emails.send({
      from: fromIdentity,
      to,
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      throw error;
    }
    return true;
  } catch (err) {
    console.error('❌ Mail Service Exception:', err.message);
    throw err;
  }
};

module.exports = { sendDirectBrandMail };