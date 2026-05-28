const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const getBaseTemplate = (content) => `
<div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <div style="background-color: #ff6b00; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">YogiDesk AI</h1>
        </div>
        <div style="padding: 30px;">
            ${content}
        </div>
        <div style="background-color: #f1f1f1; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 12px; color: #666;">&copy; ${new Date().getFullYear()} YogiDesk AI. All rights reserved.</p>
            <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">A product by Vyapar Wallah</p>
        </div>
    </div>
</div>
`;

exports.sendWelcomeEmail = async (email, name, businessName) => {
    const content = `
        <h2 style="color: #111827; margin-top: 0;">Welcome to our Family!</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Dear ${name},</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Thank you for joining <strong>YogiDesk AI</strong>. We are thrilled to have ${businessName} on board. Our premium tools are designed to streamline your practice and elevate your patient experience to the highest standards.</p>
        <div style="margin: 30px 0; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background-color: #ff6b00; color: #fff; padding: 12px 20px; font-weight: bold; text-align: center;">
                🌟 Driving Growth in Healthcare
            </div>
            <div style="padding: 20px; background-color: #fffaf5; text-align: center;">
                <p style="margin: 0; font-size: 16px; color: #333; line-height: 1.5;">
                    Join <strong>10,000+ Doctors</strong> who successfully increased their clinic's patient footfall by up to <strong>40% last month</strong> using YogiDesk AI's intelligent patient engagement and automated reminder systems.
                </p>
            </div>
        </div>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">If you need any assistance, our dedicated enterprise support team is always here for you.</p>
    `;
    try {
        await transporter.sendMail({
            from: `"YogiDesk AI" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Welcome to our Family - YogiDesk AI",
            html: getBaseTemplate(content)
        });
        return true;
    } catch (error) {
        console.error("Email Error:", error);
        return false;
    }
};

exports.sendLoginAlert = async (email, name, deviceInfo, ipAddress) => {
    const currentTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' });
    const content = `
        <h2 style="color: #111827; margin-top: 0;">New Login Alert</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Dear ${name},</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">We noticed a new login to your YogiDesk AI account. Here are the accurate details of this session:</p>
        <div style="background-color: #f8f9fa; border-left: 4px solid #ff6b00; padding: 15px; margin: 20px 0; font-size: 14px; color: #333;">
            <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${currentTime} (IST)</p>
            <p style="margin: 5px 0;"><strong>Device/Browser:</strong> ${deviceInfo}</p>
            <p style="margin: 5px 0;"><strong>IP Address:</strong> ${ipAddress}</p>
        </div>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">If this was you, no further action is required. If you do not recognize this activity, please secure your account immediately or contact support.</p>
    `;
    try {
        await transporter.sendMail({
            from: `"YogiDesk AI Security" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Security Alert: New Login - YogiDesk AI",
            html: getBaseTemplate(content)
        });
        return true;
    } catch (error) {
        console.error("Email Error:", error);
        return false;
    }
};

exports.sendOTP = async (email, name, otp) => {
    const content = `
        <h2 style="color: #111827; margin-top: 0;">Your Security Code</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Dear ${name},</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Please use the following One-Time Password (OTP) to complete your secure verification:</p>
        <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: bold; color: #ff6b00; padding: 15px 30px; background-color: #fff5eb; border: 2px dashed #ff6b00; border-radius: 8px; letter-spacing: 4px;">${otp}</span>
        </div>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">This code will expire in 10 minutes. Please do not share it with anyone.</p>
    `;
    try {
        await transporter.sendMail({
            from: `"YogiDesk AI Security" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Your OTP Code - YogiDesk AI",
            html: getBaseTemplate(content)
        });
        return true;
    } catch (error) {
        console.error("Email Error:", error);
        return false;
    }
};

exports.sendDirectEmail = async (email, subject, htmlContent) => {
    try {
        await transporter.sendMail({ from: `"YogiDesk AI" <${process.env.SMTP_USER}>`, to: email, subject, html: htmlContent });
        return true;
    } catch (error) { return false; }
};