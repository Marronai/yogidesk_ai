const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends a direct branded email using Resend API bypassing standard SMTP/Supabase triggers.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} htmlContent - Responsive HTML content with brand styling.
 */
const sendDirectBrandMail = async (to, subject, htmlContent) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Yogi Desk AI <otp@vyaparwallah.in>', // Temporarily fallback to Resend's default testing identity
      to,
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ Mail Service Exception:', err.message);
    return false;
  }
};

module.exports = { sendDirectBrandMail };