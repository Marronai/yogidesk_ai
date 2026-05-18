// File: backend/utils/emailTemplates.js

// 1. Welcome Email Template (Modern & Professional)
const welcomeEmailTemplate = (name, loginLink) => {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
      <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://via.placeholder.com/150x50?text=YogiDesk+AI" alt="YogiDesk Logo" style="max-width: 150px;">
        </div>

        <h1 style="color: #333333; font-size: 24px; text-align: center; margin-bottom: 10px;">Welcome to YogiDesk AI! 🚀</h1>
        <p style="color: #666666; font-size: 16px; text-align: center; margin-bottom: 30px;">
          Hi ${name}, we are thrilled to have you on board.
        </p>

        <p style="color: #555555; line-height: 1.6; font-size: 15px; margin-bottom: 20px;">
          Yogi Desk AI is your healthcare WhatsApp API dashboard. You can now automate responses, manage patient campaigns, and support your healthcare team effortlessly.
          <br><br>
          Your account is fully active. Click the button below to access your dashboard:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginLink}" style="background-color: #007bff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
            Login to Dashboard
          </a>
        </div>

        <p style="text-align: center; font-size: 14px; color: #999;">
          Or copy this link: <a href="${loginLink}" style="color: #007bff;">${loginLink}</a>
        </p>
        
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 30px 0;">

        <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px; color: #0056b3; font-size: 16px;">Need Help?</h3>
          <p style="margin: 0; color: #555; font-size: 14px;">
            Our support team is here for you 24/7.
            <br>📧 Email: <strong>support@yogidesk.com</strong>
            <br>📞 WhatsApp: <strong>+91-XXXXXXXXXX</strong>
          </p>
        </div>

        <p style="text-align: center; font-size: 12px; color: #aaaaaa; margin-top: 20px;">
          Regards,<br>
          <strong>Team Yogi Desk AI</strong><br>
          Yogi Desk
        </p>
      </div>
    </div>
  `;
};

// 2. OTP Template (Simple)
const otpEmailTemplate = (otp) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
      <h2>Verify your Yogi Desk AI Account</h2>
      <p>Use the OTP below to complete your signup process.</p>
      <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
      <p>This OTP is valid for 10 minutes.</p>
    </div>
  `;
};

module.exports = { welcomeEmailTemplate, otpEmailTemplate };
