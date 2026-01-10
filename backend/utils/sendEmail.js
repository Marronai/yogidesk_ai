const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  try {
    // 👇 UPDATE: Response ko sahi se todna (Destructure) zaroori hai
    const { data, error } = await resend.emails.send({
      from: 'no-reply@yogidesk-ai.com', // Testing email
      to: options.email,
      subject: options.subject,
      html: options.message,
    });

    // 🛑 Agar Error aaya hai, toh use Chhupao mat, Log karo!
    if (error) {
      console.error("❌ Resend API Error:", error);
      return; 
    }

    console.log("✅ Email sent successfully. ID:", data.id);
    return data;
  } catch (err) {
    console.error("Server Connection Error:", err);
  }
};

module.exports = sendEmail;

