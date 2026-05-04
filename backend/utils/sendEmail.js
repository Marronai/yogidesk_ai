const { Resend } = require('resend');

const sendEmail = async (options) => {
    // Function ke ANDAR initialize karein, bahar nahi!
    const resend = new Resend(process.env.RESEND_API_KEY); 

    try {
        const { data, error } = await resend.emails.send({
            from: 'no-reply@yogidesk-ai.com',
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

