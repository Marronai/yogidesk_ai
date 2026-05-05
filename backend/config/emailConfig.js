const nodemailer = require('nodemailer');

// 🛠️ Nodemailer Transporter for Hostinger Business Email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: process.env.EMAIL_PORT || 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
          <p class="logo">🧘 YogiDesk</p>
        </div>
        
        <div class="content">
          <p class="greeting">Hello ${userName},</p>
          
          <p class="message">
            Thank you for signing up with YogiDesk! To complete your account verification, please use the following One-Time Password (OTP):
          </p>
          
          <div class="otp-box">
            <p class="otp-title">Your Verification Code</p>
            <p class="otp-code">${otp}</p>
            <p class="expiry">⏱️ This OTP will expire in 10 minutes</p>
          </div>
          
          <div class="security-note">
            <strong>🔒 Security Note:</strong> Never share this OTP with anyone. YogiDesk support will never ask for your OTP.
          </div>
          
          <p class="message">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
        
        <div class="footer">
          <p>© 2024 YogiDesk. All rights reserved.</p>
          <p>YogiDesk AI | Your Business Intelligence Partner</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// 🛠️ Send OTP Function
const sendOTP = async (email, userName, otp) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('❌ Email credentials not configured in .env');
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🔐 Your YogiDesk Verification Code',
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

// 🛠️ Verify Transporter Connection (Optional - for testing)
const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Nodemailer transporter connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Nodemailer connection failed:', error.message);
    return false;
  }
};

module.exports = { transporter, sendOTP, verifyConnection };
