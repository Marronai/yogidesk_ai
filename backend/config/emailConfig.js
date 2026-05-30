const axios = require('axios');
const { getWelcomeEmailHTML } = require('../utils/emailTemplates');

const BREVO_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL || 'info@vyaparwallah.com';
const ONBOARDING_FROM_EMAIL = process.env.BREVO_ONBOARDING_FROM_EMAIL || process.env.BREVO_REPLY_TO_EMAIL || DEFAULT_FROM_EMAIL;
const DEFAULT_FROM_NAME = process.env.BREVO_FROM_NAME || 'Yogi Desk AI';
const REPLY_TO_EMAIL = process.env.BREVO_REPLY_TO_EMAIL || ONBOARDING_FROM_EMAIL;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeRecipientEmail = (email) => String(email || '').trim().toLowerCase();
const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const sendBrevoEmail = async ({ to, subject, htmlContent, senderType = 'system' }) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.error('Brevo email skipped: BREVO_API_KEY is not configured.');
        return false;
    }

    const recipientEmail = normalizeRecipientEmail(to);
    if (!EMAIL_PATTERN.test(recipientEmail)) {
        console.error('Brevo email skipped: invalid recipient email.', { to: recipientEmail || '(empty)' });
        return false;
    }

    const fromEmail = senderType === 'onboarding' ? ONBOARDING_FROM_EMAIL : DEFAULT_FROM_EMAIL;

    try {
        const response = await axios.post(BREVO_EMAIL_API_URL, {
            sender: { name: DEFAULT_FROM_NAME, email: fromEmail },
            to: [{ email: recipientEmail }],
            replyTo: { email: REPLY_TO_EMAIL, name: DEFAULT_FROM_NAME },
            subject,
            htmlContent,
        }, {
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        const messageId = response.data?.messageId || response.data?.messageIds?.[0] || 'accepted-no-message-id';
        console.log(`Brevo mail accepted for ${recipientEmail} via ${fromEmail}. messageId=${messageId}`);
        return true;
    } catch (error) {
        console.error('Brevo Email Error:', error.response?.data || error.message || error);
        return false;
    }
};

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
    return sendBrevoEmail({
        to: email,
        subject: "Welcome to Yogi Desk AI - Your Premium Growth Trial is Active",
        htmlContent: getWelcomeEmailHTML(name || businessName || 'Doctor'),
        senderType: 'onboarding',
    });
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
    return sendBrevoEmail({
        to: email,
        subject: "Security Alert: New Login - YogiDesk AI",
        htmlContent: getBaseTemplate(content),
    });
};

exports.sendOTP = async (email, name, otp) => {
    const otpCode = escapeHtml(otp);
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yogi Desk AI - Verification Code</title>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Fira Sans', Arial, sans-serif; -webkit-text-size-adjust: none; text-size-adjust: none; }
        .email-container { max-width: 550px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); }
        .brand-header { background-color: #ff6a00; padding: 30px; text-align: center; }
        .brand-name { margin: 12px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.02em; }
        .content-body { padding: 40px 35px; color: #334155; line-height: 1.6; }
        .main-title { margin: 0 0 15px 0; color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; }
        .text-desc { font-size: 15px; color: #64748b; text-align: center; margin-bottom: 30px; }
        .otp-container { background-color: #fff7ed; border: 2px dashed #ff6a00; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; }
        .otp-code { font-size: 36px; font-weight: 700; color: #ff6a00; letter-spacing: 6px; margin: 0; font-family: monospace, sans-serif; }
        .security-note { font-size: 13px; color: #94a3b8; text-align: center; margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #edf2f7; }
        @media (max-width: 620px) {
            .email-container { margin: 0; width: 100%; border-radius: 0; }
            .content-body { padding: 32px 22px; }
            .otp-code { font-size: 32px; letter-spacing: 4px; }
        }
    </style>
</head>
<body>
    <div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        Your Yogi Desk AI verification code is ${otpCode}. It expires in 10 minutes.
    </div>
    <div class="email-container">
        <div class="brand-header">
            <img src="https://yogidesk-ai.com/assets/yogidesk-logo.png" alt="" width="96" style="display: block; height: auto; margin: 0 auto; border: 0;">
            <p class="brand-name">Yogi Desk AI</p>
        </div>
        <div class="content-body">
            <h2 class="main-title">Verify Your Account</h2>
            <p class="text-desc">Use the secure One-Time Password (OTP) below to complete your authentication. This code is valid for the next 10 minutes.</p>
            <div class="otp-container">
                <h1 class="otp-code">${otpCode}</h1>
            </div>
            <p style="font-size: 14px; color: #475569; text-align: center; margin: 20px 0 0 0;">
                If you did not request this verification, please ignore this email or contact support.
            </p>
            <div class="security-note">
                Security Reminder: Yogi Desk staff will never ask for your passwords or private API keys over call or chat.
            </div>
        </div>
        <div class="footer">
            <p style="margin: 0;">&copy; 2026 Yogi Desk AI. Powered by Vyapar Wallah.</p>
            <p style="margin: 5px 0 0 0;">Patna, Bihar, India.</p>
        </div>
    </div>
</body>
</html>
`;

    return sendBrevoEmail({
        to: email,
        subject: "Yogi Desk AI Verification Code",
        htmlContent,
    });
};

exports.sendDirectEmail = async (email, subject, htmlContent, senderType = 'system') => {
    return sendBrevoEmail({ to: email, subject, htmlContent, senderType });
};

exports.verifyConnection = async () => Boolean(process.env.BREVO_API_KEY);

