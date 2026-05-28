const getWelcomeEmailHTML = (doctorName) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <style>
              body { font-family: 'Inter', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #FFFFFF; color: #111111; }
              .wrapper { max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; }
              .header { background-color: #FF6B00; padding: 48px 24px; text-align: center; }
              .header h1 { color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.02em; }
              .content { padding: 40px 32px; background-color: #FFFFFF; }
              .greeting { font-size: 22px; font-weight: 800; margin-bottom: 16px; color: #111111; }
              .text { font-size: 16px; line-height: 1.6; color: #4B5563; margin-bottom: 32px; }
              .cta-container { text-align: center; }
              .cta-button { display: inline-block; background-color: #FF6B00; color: #FFFFFF; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; transition: background-color 0.2s; }
              .footer { padding: 24px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #F3F4F6; }
          </style>
      </head>
      <body>
          <div class="wrapper">
              <div class="header">
                  <h1>YOGI DESK AI</h1>
              </div>
              <div class="content">
                  <div class="greeting">Welcome to the future of healthcare, Dr. ${doctorName}! 🚀</div>
                  <p class="text">
                      We're thrilled to have you join Yogi Desk AI. Your clinical workspace is now active, providing you with elite WhatsApp automation tools designed specifically for modern medical practices.
                  </p>
                  <p class="text">
                      You can now manage appointments, automate patient follow-ups, and coordinate your healthcare team effortlessly from one central dashboard.
                  </p>
                  <div class="cta-container">
                      <a href="https://yogidesk-ai.com/dashboard" class="cta-button">Explore Your Dashboard</a>
                  </div>
              </div>
              <div class="footer">
                  &copy; 2026 Yogi Desk AI. Empowering Doctors through AI Communication.
              </div>
          </div>
      </body>
      </html>
    `;
  };
  
  const getInviteEmailHTML = (employeeName, loginLink, temporaryPassword) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <style>
              body { font-family: 'Inter', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
              .wrapper { max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: flex; }
              .accent-bar { width: 8px; background-color: #FF6B00; flex-shrink: 0; }
              .main { padding: 48px; flex-grow: 1; }
              .title { font-size: 24px; font-weight: 900; color: #111111; margin-bottom: 24px; }
              .text { font-size: 15px; line-height: 1.6; color: #4B5563; margin-bottom: 24px; }
              .creds-box { background-color: #F3F4F6; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px dashed #D1D5DB; }
              .cred-item { margin-bottom: 8px; font-size: 14px; color: #374151; }
              .cred-item strong { color: #FF6B00; font-weight: 700; }
              .cta-button { display: inline-block; background-color: #111111; color: #FFFFFF; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; }
              .footer { margin-top: 40px; font-size: 12px; color: #9CA3AF; }
          </style>
      </head>
      <body>
          <div class="wrapper">
              <div class="accent-bar"></div>
              <div class="main">
                  <div class="title">Join Your Clinical Team</div>
                  <p class="text">Hi ${employeeName}, your administrator has invited you to join their healthcare workspace on Yogi Desk AI. You can now access the team inbox and patient management tools.</p>
                  
                  <div class="creds-box">
                      <div class="cred-item"><strong>Login URL:</strong> ${loginLink}</div>
                      <div class="cred-item"><strong>Temporary Password:</strong> ${temporaryPassword}</div>
                  </div>
  
                  <p class="text" style="font-size: 13px; font-style: italic;">For security reasons, please update your password immediately after your first login.</p>
  
                  <a href="${loginLink}" class="cta-button">Access Workspace</a>
  
                  <div class="footer">
                      This is an automated invitation from Yogi Desk AI.
                  </div>
              </div>
          </div>
      </body>
      </html>
    `;
  };
  
  module.exports = { getWelcomeEmailHTML, getInviteEmailHTML };
