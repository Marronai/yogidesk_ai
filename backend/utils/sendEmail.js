const { Resend } = require('resend');

// Render ke Environment Variable se Key lega
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  try {
    const data = await resend.emails.send({
      // ⚠️ IMPORTANT: 'from' mein wahi domain daalo jo Resend.com par verify kiya hai
      from: 'YogiDesk Team <no-reply@yogidesk.com>', 
      to: options.email,
      subject: options.subject,
      html: options.message,
    });

    console.log("Email sent successfully via Resend. ID:", data.id);
    return data;
  } catch (error) {
    console.error("Resend Email Error:", error);
    // Error ko throw nahi karenge taaki server crash na ho, bas log karenge
  }
};

module.exports = sendEmail;