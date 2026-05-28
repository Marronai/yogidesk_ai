const axios = require('axios');

const brevoApiKey = process.env.BREVO_API_KEY;
const brevoEmailApiUrl = 'https://api.brevo.com/v3/smtp/email';

if (!brevoApiKey) {
  console.error('Brevo email is not configured. Please add BREVO_API_KEY in the backend environment.');
}

const getBrevoSender = (senderType = 'system') => ({
  name: 'Yogi Desk AI',
  email: senderType === 'onboarding'
    ? 'support@yogidesk-ai.com'
    : 'no-reply@yogidesk-ai.com'
});

const sendViaBrevo = async ({ to, subject, html, senderType }) => {
  if (!brevoApiKey) return false;

  await axios.post(brevoEmailApiUrl, {
    sender: getBrevoSender(senderType),
    to: [{ email: to }],
    subject,
    htmlContent: html
  }, {
    headers: {
      'api-key': brevoApiKey,
      'Content-Type': 'application/json'
    },
    timeout: 6000
  });

  console.log(`Email sent via Brevo to ${to}`);
  return true;
};


const deliverMail = async ({ to, subject, html, senderType = 'system', purpose = 'email' }) => {
  if (!to) {
    console.error(`Failed to send ${purpose}: recipient email is missing.`);
    return false;
  }

  try {
    if (!brevoApiKey) {
      console.error(`Email sending is not configured for ${purpose}. Add BREVO_API_KEY.`);
      return false;
    }

    return await sendViaBrevo({ to, subject, html, senderType });
  } catch (primaryError) {
    console.error(`Brevo ${purpose} email send failed:`, primaryError.response?.data || primaryError.message);
    return false;
  }
};

// 🛠️ Send OTP Email Function
const sendOTP = async (email, userName, otp) => {
  try {
    const sent = await deliverMail({
      to: email,
      subject: 'Your Yogi Desk AI OTP Code',
      html: otpEmailTemplate(userName, otp),
      senderType: 'system',
      purpose: 'OTP'
    });
    if (sent) console.log('OTP email sent successfully');
    return sent;
  } catch (error) {
    console.error('❌ Failed to send OTP email:', error.message);
    return false;
  }
};

// 🛠️ Professional HTML Email Template for OTP
const otpEmailTemplate = (userName, otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          padding: 20px;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px 20px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #ffffff;
          margin: 0;
        }
        .content {
          padding: 40px 20px;
          text-align: center;
        }
        .greeting {
          font-size: 18px;
          color: #333333;
          margin: 0 0 10px 0;
        }
        .message {
          font-size: 14px;
          color: #666666;
          line-height: 1.6;
          margin: 20px 0;
        }
        .otp-box {
          background-color: #f0f0f0;
          border: 2px solid #667eea;
          border-radius: 8px;
          padding: 20px;
          margin: 30px 0;
        }
        .otp-title {
          font-size: 12px;
          color: #999999;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0 0 10px 0;
        }
        .otp-code {
          font-size: 36px;
          font-weight: bold;
          color: #667eea;
          letter-spacing: 8px;
          margin: 0;
          font-family: 'Courier New', monospace;
        }
        .expiry {
          font-size: 12px;
          color: #e74c3c;
          margin-top: 15px;
        }
        .footer {
          background-color: #f9f9f9;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #eeeeee;
          font-size: 12px;
          color: #999999;
        }
        .security-note {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin-top: 20px;
          border-radius: 4px;
          font-size: 12px;
          color: #856404;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <p class="logo">Yogi Desk AI</p>
        </div>
        
        <div class="content">
          <p class="greeting">Hello ${userName},</p>
          
          <p class="message">
            Thank you for signing up with Yogi Desk AI! To complete your account verification, please use the following One-Time Password (OTP):
          </p>
          
          <div class="otp-box">
            <p class="otp-title">Your Verification Code</p>
            <p class="otp-code">${otp}</p>
            <p class="expiry">⏱️ This OTP will expire in 10 minutes</p>
          </div>
          
          <div class="security-note">
            <strong>🔒 Security Note:</strong> Never share this OTP with anyone. Yogi Desk AI support will never ask for your OTP.
          </div>
          
          <p class="message">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
        
        <div class="footer">
          <p>© 2026 Yogi Desk AI. All rights reserved.</p>
          <p>Yogi Desk AI | Your Healthcare Communication Partner</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// 🛠️ Professional Welcome Email Template for New Users
const welcomeEmailTemplate = (userName, businessName, email) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f7fb;
          padding: 20px;
          margin: 0;
        }
        .email-container {
          max-width: 620px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 22px 60px rgba(16, 24, 40, 0.08);
          border: 1px solid #e2e8f0;
        }
        .header {
          background: linear-gradient(135deg, #ff6b00 0%, #0f3f74 100%);
          padding: 40px 20px;
          text-align: center;
        }
        .logo {
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }
        .content {
          padding: 36px 28px;
          text-align: center;
        }
        .greeting {
          font-size: 26px;
          color: #111827;
          margin: 0 0 12px 0;
          font-weight: 700;
        }
        .message {
          font-size: 16px;
          color: #4b5563;
          line-height: 1.8;
          margin: 18px 0;
        }
        .detail-box {
          background: #f8fafc;
          border: 1px solid #dbeafe;
          border-radius: 14px;
          padding: 22px;
          margin: 30px 0;
          text-align: left;
        }
        .detail-title {
          font-size: 14px;
          color: #0f172a;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .detail-line {
          margin: 8px 0;
          color: #475569;
          font-size: 15px;
        }
        .cta-button {
          display: inline-block;
          background-color: #ff6b00;
          color: #ffffff;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 999px;
          font-weight: 700;
          font-size: 16px;
          margin: 18px 0;
        }
        .footer {
          background-color: #f8fafc;
          padding: 24px 20px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
          font-size: 13px;
          color: #64748b;
        }
        .footer span {
          display: block;
          color: #1e293b;
          font-weight: 600;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <p class="logo">Yogi Desk AI</p>
        </div>

        <div class="content">
          <p class="greeting">Welcome aboard, ${userName}!</p>
          <p class="message">
            Your account for <strong>${businessName}</strong> is now active. Your registered email is <strong>${email}</strong>.
            Your Yogi Wallet includes prepaid WhatsApp credits for appointment replies, patient follow-ups, and healthcare team tools.
          </p>

          <div class="detail-box">
            <p class="detail-title">What you get</p>
            <p class="detail-line">- Prepaid wallet access with transparent message rates</p>
            <p class="detail-line">- Admin access for your healthcare team</p>
            <p class="detail-line">- Ready-made WhatsApp workflows and campaign tools</p>
          </div>

          <a href="https://yogidesk-ai.com/dashboard" class="cta-button">Go to Dashboard</a>

          <p class="message">
            If you need help setting up, our support team is ready to assist. Enjoy the journey with Yogi Desk AI!
          </p>
        </div>

        <div class="footer">
          © 2026 Yogi Desk. All rights reserved.
          <span>A product of Yogi Desk</span>
        </div>
      </div>
    </body>
    </html>
  `;
};

// 🛠️ Send Welcome Email Function
const sendWelcomeEmail = async (email, userName, businessName) => {
  try {
    const sent = await deliverMail({
      to: email,
      subject: 'Welcome to Yogi Desk AI - Your Clinic Workspace Is Ready!',
      html: welcomeEmailTemplate(userName, businessName, email),
      senderType: 'onboarding',
      purpose: 'welcome'
    });
    if (sent) console.log('Welcome email sent successfully');
    return sent;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error.message);
    return false;
  }
};

const loginAlertTemplate = (userName, deviceInfo, ipAddress) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #eef2ff;
          padding: 20px;
          margin: 0;
        }
        .email-container {
          max-width: 620px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
          border: 1px solid #e2e8f0;
        }
        .header {
          background: linear-gradient(135deg, #ff6b00 0%, #003366 100%);
          padding: 30px 22px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }
        .content {
          padding: 34px 26px;
          color: #111827;
        }
        .greeting {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 14px;
        }
        .message {
          font-size: 15px;
          line-height: 1.8;
          color: #475569;
          margin: 16px 0;
        }
        .detail-box {
          background: #f8fafc;
          border: 1px solid #dbeafe;
          border-radius: 14px;
          padding: 20px;
          margin: 24px 0;
          text-align: left;
        }
        .detail-heading {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #0f172a;
          margin-bottom: 10px;
        }
        .detail-text {
          font-size: 14px;
          color: #334155;
          margin: 6px 0;
        }
        .button-wrap {
          text-align: center;
          margin: 26px 0;
        }
        .cta-button {
          display: inline-block;
          background-color: #ff6b00;
          color: #ffffff;
          text-decoration: none;
          padding: 14px 34px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 15px;
        }
        .footer {
          padding: 20px;
          text-align: center;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 13px;
        }
        .footer span {
          display: block;
          margin-top: 6px;
          color: #0f172a;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <p class="logo">Yogi Desk AI</p>
        </div>
        <div class="content">
          <p class="greeting">Hi ${userName},</p>
          <p class="message">We noticed a successful login to your Yogi Desk AI dashboard. If this was you, great! If not, you should change your password immediately.</p>
          <div class="detail-box">
            <p class="detail-heading">Login details</p>
            <p class="detail-text"><strong>Device:</strong> ${deviceInfo}</p>
            <p class="detail-text"><strong>IP Address:</strong> ${ipAddress}</p>
            <p class="detail-text"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="button-wrap">
            <a href="https://yogidesk-ai.com/forgot-password" class="cta-button">Change Password</a>
          </div>
          <p class="message">If you did not log in, please contact support immediately or reset your password from the app.</p>
        </div>
        <div class="footer">
          © 2026 Yogi Desk. All rights reserved.
          <span>A product of Yogi Desk</span>
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendLoginAlert = async (email, userName, deviceInfo, ipAddress) => {
  try {
    const sent = await deliverMail({
      to: email,
      subject: 'New Login Alert for Your Yogi Desk AI Account',
      html: loginAlertTemplate(userName, deviceInfo, ipAddress),
      senderType: 'system',
      purpose: 'login alert'
    });
    if (sent) console.log('Login alert email sent successfully');
    return sent;
  } catch (error) {
    console.error('❌ Failed to send login alert email:', error.message);
    return false;
  }
};

// Brevo connection/config check
const sendDirectEmail = async (to, subject, htmlContent, senderType = 'system') => (
  deliverMail({
    to,
    subject,
    html: htmlContent,
    senderType,
    purpose: 'direct'
  })
);

const verifyConnection = async () => {
  if (!brevoApiKey) {
    console.error('Brevo email unavailable: missing BREVO_API_KEY.');
    return false;
  }

  console.log('Brevo API key configured; transactional email will use Brevo HTTPS API.');
  return true;
};

module.exports = { sendOTP, sendWelcomeEmail, sendLoginAlert, sendDirectEmail, verifyConnection };
