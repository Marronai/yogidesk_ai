const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM || 'welcome@vyaparwallah.in';

const missingEmailVars = [];
if (!smtpHost) missingEmailVars.push('SMTP_HOST');
if (!process.env.SMTP_PORT) missingEmailVars.push('SMTP_PORT');
if (!smtpUser) missingEmailVars.push('SMTP_USER');
if (!smtpPass) missingEmailVars.push('SMTP_PASS');

if (missingEmailVars.length > 0) {
  console.error(`❌ Missing email configuration variables in .env: ${missingEmailVars.join(', ')}.`);
  console.error('   Email sending is disabled until these values are defined.');
}

const transporter = missingEmailVars.length === 0
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })
  : null;

// 🛠️ Send OTP Email Function
const sendOTP = async (email, userName, otp) => {
  try {
    if (!transporter || !emailFrom) {
      console.error('❌ Nodemailer is not configured for OTP emails. Missing SMTP settings or EMAIL_FROM.');
      return false;
    }

    const mailOptions = {
      from: emailFrom,
      to: email,
      subject: 'Your Vyapar Wallah OTP Code',
      html: otpEmailTemplate(userName, otp)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP Email sent successfully:', info.response);
    return true;
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
          <p class="logo">Vyapar Wallah</p>
        </div>
        
        <div class="content">
          <p class="greeting">Hello ${userName},</p>
          
          <p class="message">
            Thank you for signing up with Vyapar Wallah! To complete your account verification, please use the following One-Time Password (OTP):
          </p>
          
          <div class="otp-box">
            <p class="otp-title">Your Verification Code</p>
            <p class="otp-code">${otp}</p>
            <p class="expiry">⏱️ This OTP will expire in 10 minutes</p>
          </div>
          
          <div class="security-note">
            <strong>🔒 Security Note:</strong> Never share this OTP with anyone. Vyapar Wallah support will never ask for your OTP.
          </div>
          
          <p class="message">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
        
        <div class="footer">
          <p>© 2024 Vyapar Wallah. All rights reserved.</p>
          <p>Vyapar Wallah | Your Business Intelligence Partner</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// 🛠️ Professional Welcome Email Template for New Users
const welcomeEmailTemplate = (userName, businessName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #ffffff;
          padding: 20px;
          margin: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          border: 1px solid #e0e0e0;
        }
        .header {
          background: linear-gradient(135deg, #FF6B00 0%, #002D62 100%);
          padding: 40px 20px;
          text-align: center;
        }
        .logo {
          font-size: 32px;
          font-weight: bold;
          color: #ffffff;
          margin: 0;
        }
        .content {
          padding: 40px 20px;
          text-align: center;
        }
        .greeting {
          font-size: 24px;
          color: #333333;
          margin: 0 0 10px 0;
          font-weight: 600;
        }
        .message {
          font-size: 16px;
          color: #666666;
          line-height: 1.6;
          margin: 20px 0;
        }
        .highlight-box {
          background-color: #f8f9fa;
          border-left: 4px solid #FF6B00;
          padding: 20px;
          margin: 30px 0;
          border-radius: 4px;
        }
        .highlight-title {
          font-size: 18px;
          color: #FF6B00;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .cta-button {
          display: inline-block;
          background-color: #FF6B00;
          color: #ffffff;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          font-size: 16px;
          margin: 20px 0;
          transition: background-color 0.3s;
        }
        .cta-button:hover {
          background-color: #e55a00;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #e0e0e0;
          font-size: 12px;
          color: #666666;
        }
        .branding {
          font-size: 11px;
          color: #999999;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <p class="logo">Vyapar Wallah</p>
        </div>

        <div class="content">
          <p class="greeting">Welcome to Vyapar Wallah, ${userName}!</p>

          <p class="message">
            Congratulations! Your account for <strong>${businessName}</strong> has been successfully created.
            We're excited to help you automate customer communication and grow your business.
          </p>

          <div class="highlight-box">
            <p class="highlight-title">🎉 Your 14-Day Free Trial Has Started!</p>
            <p class="message">
              Explore all features, integrate WhatsApp, and see how Vyapar Wallah can transform your customer interactions.
              No credit card required to get started.
            </p>
          </div>

          <a href="https://yogidesk-ai.com/dashboard" class="cta-button">Start Exploring Dashboard</a>

          <p class="message">
            Need help getting started? Check out our <a href="https://yogidesk-ai.com/support" style="color: #002D62; text-decoration: none; font-weight: bold;">support resources</a> or contact our team.
          </p>
        </div>

        <div class="footer">
          <p>© 2024 Vyapar Wallah. All rights reserved.</p>
          <p class="branding">A product of Vyapar Wallah</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// 🛠️ Send Welcome Email Function
const sendWelcomeEmail = async (email, userName, businessName) => {
  try {
    if (!transporter) {
      console.error('❌ Nodemailer is not configured for welcome emails.');
      return false;
    }

    const mailOptions = {
      from: emailFrom,
      to: email,
      subject: '🎉 Welcome to Vyapar Wallah - Your 14-Day Free Trial Starts Now!',
      html: welcomeEmailTemplate(userName, businessName)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome Email sent successfully:', info.response);
    return true;
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
          background-color: #f8fafc;
          padding: 20px;
        }
        .email-container {
          max-width: 620px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 16px 40px rgba(0,0,0,0.08);
        }
        .header {
          background: linear-gradient(135deg, #FF6B00 0%, #003366 100%);
          padding: 30px 20px;
          text-align: center;
        }
        .logo {
          font-size: 26px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }
        .content {
          padding: 36px 24px;
          color: #1f2937;
        }
        .greeting {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 12px;
        }
        .message {
          font-size: 15px;
          line-height: 1.75;
          color: #4b5563;
          margin: 16px 0;
        }
        .detail-box {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px 20px;
          margin: 20px 0;
        }
        .detail-heading {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #111827;
          margin-bottom: 8px;
        }
        .detail-text {
          font-size: 14px;
          color: #374151;
          margin: 0;
        }
        .button-wrap {
          text-align: center;
          margin: 25px 0;
        }
        .cta-button {
          display: inline-block;
          background-color: #FF6B00;
          color: #ffffff;
          text-decoration: none;
          padding: 14px 26px;
          border-radius: 999px;
          font-weight: 700;
          box-shadow: 0 12px 30px rgba(255,107,0,0.2);
        }
        .footer {
          padding: 18px 20px 30px;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
          background: #f3f4f6;
        }
        .footer .branding {
          font-weight: 700;
          color: #111827;
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <p class="logo">Vyapar Wallah</p>
        </div>
        <div class="content">
          <p class="greeting">Hi ${userName},</p>
          <p class="message">We noticed a successful login to your Vyapar Wallah dashboard. If this was you, great! If not, please reset your password immediately.</p>
          <div class="detail-box">
            <p class="detail-heading">Login details</p>
            <p class="detail-text"><strong>Device:</strong> ${deviceInfo}</p>
            <p class="detail-text"><strong>IP Address:</strong> ${ipAddress}</p>
            <p class="detail-text"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="button-wrap">
            <a href="https://yogidesk-ai.com/forgot-password" class="cta-button">Reset your password</a>
          </div>
          <p class="message">If you did not log in, please contact support immediately or change your password from the dashboard.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Vyapar Wallah. All rights reserved.</p>
          <p class="branding">A product of Vyapar Wallah</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendLoginAlert = async (email, userName, deviceInfo, ipAddress) => {
  try {
    if (!transporter) {
      console.error('❌ Nodemailer is not configured for login alerts.');
      return false;
    }

    const mailOptions = {
      from: emailFrom,
      to: email,
      subject: '🔐 New Login Alert for Your Vyapar Wallah Account',
      html: loginAlertTemplate(userName, deviceInfo, ipAddress)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Login alert email sent successfully:', info.response);
    return true;
  } catch (error) {
    console.error('❌ Failed to send login alert email:', error.message);
    return false;
  }
};

// 🛠️ Verify Transporter Connection (Optional - for testing)
const verifyConnection = async () => {
  if (!transporter) {
    console.error('❌ Nodemailer transporter unavailable: missing SMTP configuration.');
    return false;
  }

  try {
    await transporter.verify();
    console.log('✅ Nodemailer transporter connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Nodemailer connection failed:', error.message);
    return false;
  }
};

module.exports = { transporter, sendOTP, sendWelcomeEmail, sendLoginAlert, verifyConnection };
