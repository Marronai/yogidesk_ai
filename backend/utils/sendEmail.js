const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  console.log("-------------------------------------------");
  console.log("📧 EMAIL PROCESS STARTED...");
  
  // 1. Credentials Check (Passwords mat dikhana, bas length check karo)
  console.log("🔍 Checking Credentials:");
  console.log("   -> User:", process.env.BREVO_USER || "MISSING");
  console.log("   -> Pass Length:", process.env.BREVO_PASS ? process.env.BREVO_PASS.length : "MISSING");

  // 2. Transporter Create
  // AGAR TUM GMAIL USE KAR RAHE HO TOH YE UNCOMMENT KARO:
  /*
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.BREVO_USER, 
      pass: process.env.BREVO_PASS, 
    },
  });
  */

  // AGAR TUM BREVO USE KAR RAHE HO TOH YE RAKHO:
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587, // Agar fail ho toh 2525 try karna
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS,
    },
  });

  // 3. Email Options
  const message = {
    from: `"Marroncorp Support" <${process.env.BREVO_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  console.log(`📤 Attempting to send to: ${options.email}`);

  try {
    const info = await transporter.sendMail(message);
    console.log("✅ SUCCESS! Email Sent.");
    console.log("   -> Message ID:", info.messageId);
  } catch (error) {
    console.error("❌ FAILURE! Email Nahi Gaya.");
    console.error("   -> Error Code:", error.code);
    console.error("   -> Error Message:", error.message);
    console.error("   -> Error Response:", error.response);
  }
  console.log("-------------------------------------------");
};

module.exports = sendEmail;