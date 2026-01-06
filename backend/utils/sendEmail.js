// File: backend/utils/sendEmail.js (ya jahan bhi mail logic hai)
const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // 1. Transporter (Daakiya) - Yahan Brevo ki settings aayengi
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // Render se value lega
    port: process.env.EMAIL_PORT, // Render se value lega
    secure: false, // Brevo ke liye 587 port par false rakhte hain
    auth: {
      user: process.env.9f34b9001@smtp-brevo.com, // Tumhara Brevo Login Email
      pass: process.env.xsmtpsib-9882d73242399dd9d9ca9abbda224f6f97f367ddc22d72548549c842c67cccaa-PMSBDgcHnQz2fPz5, // Brevo SMTP Key (Password nahi!)
    },
  });

  // 2. Email Details
  const mailOptions = {
    from: process.env.no-reply@yogidesk-AirVent.com, // ⚠️ ZAROORI: Ye wahi email ho jo Brevo me verify hai
    to: options.email,
    subject: options.subject,
    html: options.message, // Ya tumhara template HTML
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;