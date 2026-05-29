const emailConfig = require('../config/emailConfig');

const sendDirectBrandMail = async (to, subject, htmlContent, senderType = 'system') => {
  if (typeof emailConfig.sendDirectEmail !== 'function') {
    console.error('Brevo direct mail skipped: emailConfig.sendDirectEmail is unavailable.');
    return false;
  }

  return emailConfig.sendDirectEmail(to, subject, htmlContent, senderType);
};

module.exports = { sendDirectBrandMail };
