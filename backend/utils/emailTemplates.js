const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getWelcomeEmailHTML = (doctorName = 'Doctor') => {
  const safeDoctorName = escapeHtml(String(doctorName || 'Doctor').replace(/^dr\.?\s*/i, '').trim() || 'Doctor');

  return `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <title>Welcome to Yogi Desk AI</title>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@100;200;300;400;500;600;700;800;900" rel="stylesheet" type="text/css">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }
    #MessageViewBody a { color: inherit; text-decoration: none; }
    p { line-height: inherit; }
    .desktop_hide, .desktop_hide table { mso-hide: all; display: none; max-height: 0px; overflow: hidden; }
    .image_block img + div { display: none; }
    sup, sub { font-size: 75%; line-height: 0; }
    .menu_block.desktop_hide .menu-links span { mso-hide: all; }
    @media (max-width: 700px) {
      .icons-inner { text-align: center; }
      .icons-inner td { margin: 0 auto; }
      .image_block div.fullWidth { max-width: 100% !important; }
      .row-content { width: 100% !important; }
      .stack .column { width: 100% !important; display: block !important; }
      .mobile_hide { min-height: 0; max-height: 0; max-width: 0; display: none; overflow: hidden; font-size: 0; }
      .desktop_hide, .desktop_hide table { display: table !important; max-height: none !important; }
      .row-1 .column-1 .block-3.heading_block h1 { font-size: 36px !important; }
      .row-3 .column-1 .block-1.heading_block h2 { text-align: center !important; font-size: 28px !important; }
      .row-5 .row-content { padding: 15px !important; }
      .row-6 .row-content { padding: 10px !important; }
      .row-6 .column-2 .col-pad { border: 1px solid #ff6a00; padding: 5px !important; }
      .mobile_center { text-align: center !important; }
      .mobile_pad { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body class="body" style="margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none; background-color: #fcfbfa;">
  <div style="display:none;font-size:1px;color:#fcfbfa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Your 7-Day Premium Growth Trial and Rs. 50 welcome credits are active.
  </div>
  <table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fcfbfa;">
    <tbody>
      <tr>
        <td>
          <table class="row row-1" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #ffffff; padding-top: 20px;">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 680px; margin: 0 auto;" width="680">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">
                          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="col-pad" style="padding-top:5px;">
                                <table class="brand_header block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                                  <tr>
                                    <td class="pad" style="background-color:#ff6a00; padding: 24px 16px; width:100%; text-align:center;" align="center">
                                      <div style="color:#ffffff; font-family:Fira Sans, Arial, sans-serif; font-size:24px; font-weight:700; line-height:1.2; letter-spacing:0.02em;">YogiDesk AI</div>
                                    </td>
                                  </tr>
                                </table>

                                <table class="heading_block block-3" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation">
                                  <tr>
                                    <td class="pad" style="width:100%;" align="center">
                                      <h1 style="margin: 0; color: #1e293b; font-family: Fira Sans, Arial, sans-serif; font-size: 42px; font-weight: 700; text-align: center; line-height: 1.2;">Welcome to Yogi Desk AI</h1>
                                    </td>
                                  </tr>
                                </table>

                                <table class="paragraph_block block-4" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                                  <tr>
                                    <td class="pad mobile_pad" style="padding: 10px 20px 25px 20px;">
                                      <div style="color:#334155; font-family:Fira Sans, Arial, sans-serif; font-size:18px; font-weight:400; line-height:1.6; text-align:center;">
                                        <p style="margin: 0; margin-bottom: 10px;">Hello <strong>Dr. ${safeDoctorName}</strong>,</p>
                                        <p style="margin: 0;">Your clinic onboarding is successful! To give you the ultimate automation experience, we have activated your <strong>7-Day Premium Growth Trial</strong> and added <strong>Rs. 50 Free Credits</strong> directly into your wallet.</p>
                                      </div>
                                    </td>
                                  </tr>
                                </table>

                                <table class="button_block block-5" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation">
                                  <tr>
                                    <td class="pad" align="center">
                                      <a href="https://yogidesk-ai.com/dashboard" target="_blank" style="color:#ffffff;text-decoration:none;">
                                        <span class="button" style="background-color: #ff6a00; border-radius: 60px; color: #ffffff; display: inline-block; font-family: Fira Sans, Arial, sans-serif; font-size: 16px; font-weight: 600; text-align: center; width: auto; padding: 12px 30px; letter-spacing: normal;">Start Setting Up Your Workspace &rarr;</span>
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                                <div class="spacer_block block-6" style="height:35px;">&#8202;</div>

                                <table class="image_block block-7" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                                  <tr>
                                    <td class="pad" style="width:100%;" align="center">
                                      <div style="max-width: 640px; padding: 0 10px;">
                                        <img src="https://yogidesk-ai.com/assets/dashboard-preview.png" style="display: block; height: auto; border: 0; width: 100%; border-radius: 16px;" width="640" alt="Yogi Desk Dashboard" title="Yogi Desk Dashboard">
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="row row-2" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0f172a;">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="color: #000000; width: 680px; margin: 0 auto;" width="680">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="100%" style="font-weight: 400; text-align: left; vertical-align: top;">
                          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="col-pad mobile_pad" style="padding: 40px 10px;">
                                <h2 style="margin: 0; color: #ffffff; font-family: Fira Sans, Arial, sans-serif; font-size: 32px; font-weight: 700; text-align: center; line-height: 1.3;">All-in-One WhatsApp CRM + Smart Clinic Automation</h2>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="row row-3" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0f172a; padding-bottom: 40px;">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="color: #000000; width: 680px; margin: 0 auto;" width="680">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="50%" style="font-weight: 400; text-align: left; vertical-align: middle;">
                          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="col-pad mobile_pad" style="padding: 10px 20px;">
                                <h2 class="mobile_center" style="margin: 0; color: #ffffff; font-family: Fira Sans, Arial, sans-serif; font-size: 28px; font-weight: 700; line-height: 1.3; text-align: left;">Smart Reminders for Seamless Patient Flows</h2>
                                <table class="paragraph_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                                  <tr>
                                    <td class="pad" style="padding: 15px 0;">
                                      <div class="mobile_center" style="color:#cbd5e1; font-family:Fira Sans, Arial, sans-serif; font-size:15px; font-weight:300; line-height:1.6; text-align:left;">
                                        <p style="margin: 0;">Turn missed appointments into regular visits. Our dynamic dashboard lets you dispatch appointment confirmations, follow-up recalls, and test reports with 1-click execution templates tailored specifically for your practice.</p>
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td class="column column-2" width="50%" style="font-weight: 400; text-align: left; vertical-align: middle;">
                          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="col-pad" style="padding: 10px;" align="center">
                                <div class="fullWidth" style="max-width: 300px;">
                                  <img src="https://yogidesk-ai.com/assets/feature-graph.png" style="display: block; height: auto; border: 0; width: 100%; border-radius: 12px;" width="300" alt="Clinic Analytics Dashboard">
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="row row-5" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0f172a; padding-bottom: 40px;">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 680px; margin: 0 auto;" width="680">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="46%" style="font-weight: 400; border: 1px solid #334155; vertical-align: middle; border-radius: 16px; padding: 20px;">
                          <h2 style="margin: 0; color: #ff6a00; font-family: Fira Sans, Arial, sans-serif; font-size: 30px; font-weight: 700; text-align: center;">1-Click</h2>
                          <p style="margin: 5px 0 0 0; color:#94a3b8; font-family:Fira Sans, Arial, sans-serif; font-size:14px; text-align:center;">Pre-approved templates mapped precisely to your medical speciality specs.</p>
                        </td>
                        <td class="column gap" width="8%">&nbsp;</td>
                        <td class="column column-3" width="46%" style="font-weight: 400; border: 1px solid #334155; vertical-align: middle; border-radius: 16px; padding: 20px;">
                          <h2 style="margin: 0; color: #ffffff; font-family: Fira Sans, Arial, sans-serif; font-size: 30px; font-weight: 700; text-align: center;">100%</h2>
                          <p style="margin: 5px 0 0 0; color:#94a3b8; font-family:Fira Sans, Arial, sans-serif; font-size:14px; text-align:center;">Secure automated patient reminders without manual effort.</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="row row-6" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0f172a; padding-bottom: 40px;">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 680px; margin: 0 auto;" width="680">
                    <tbody>
                      <tr>
                        <td class="column column-2" width="100%" style="font-weight: 400; border: 1px solid #ff6a00; vertical-align: top; border-radius: 16px; padding: 20px; background-color: #151e30;">
                          <h2 style="margin: 0; color: #ff6a00; font-family: Fira Sans, Arial, sans-serif; font-size: 28px; font-weight: 700; text-align: center;">24/7 Expert Support</h2>
                          <p style="margin: 10px 0 0 0; color:#e2e8f0; font-family:Fira Sans, Arial, sans-serif; font-size:14px; text-align:center;">Our customer success managers are ready to assist you with WhatsApp Green Tick applications and active API mapping anytime.</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="row row-7" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0f172a; padding-top: 20px;">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="color: #000000; width: 680px; margin: 0 auto;" width="680">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="100%" style="font-weight: 400; text-align: left; vertical-align: top;">
                          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="col-pad" style="padding-bottom:20px;" align="center">
                                <div style="max-width: 50px; margin-bottom: 15px;">
                                  <img src="https://yogidesk-ai.com/assets/favicon.png" style="display: block; height: auto; border: 0; width: 100%;" width="50" alt="Yogi Desk AI">
                                </div>
                                <h2 style="margin: 0; color: #ffffff; font-family: Fira Sans, Arial, sans-serif; font-size: 24px; font-weight: 600; text-align: center; line-height: 1.4;">Powering Growth for Modern Clinic Foundations.</h2>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="row row-9" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0f172a; padding-bottom: 20px;">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="color: #000000; width: 680px; margin: 0 auto;" width="680">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="100%" style="font-weight: 400; text-align: left; vertical-align: top;">
                          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="col-pad" style="padding: 10px 0;">
                                <div class="menu-links" style="text-align: center;">
                                  <a href="https://yogidesk-ai.com/features" style="padding: 5px 15px; color: #94a3b8; font-family: Fira Sans, Arial, sans-serif; font-size: 14px; text-decoration: none;">Features</a>
                                  <a href="https://yogidesk-ai.com/privacy-policy" style="padding: 5px 15px; color: #94a3b8; font-family: Fira Sans, Arial, sans-serif; font-size: 14px; text-decoration: none;">Privacy Policy</a>
                                  <a href="https://yogidesk-ai.com/support" style="padding: 5px 15px; color: #94a3b8; font-family: Fira Sans, Arial, sans-serif; font-size: 14px; text-decoration: none;">Support</a>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 20px 12px; color: #64748b; font-family: Fira Sans, Arial, sans-serif; font-size: 12px; text-align: center;">
                                <p style="margin: 0;">&copy; 2026 Yogi Desk AI. All rights reserved.</p>
                                <p style="margin: 5px 0 0 0;">You are receiving this email because you signed up for a trial account on Yogi Desk AI.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
};

const getInviteEmailHTML = (employeeName, loginLink, temporaryPassword) => {
  const safeEmployeeName = escapeHtml(employeeName || 'there');
  const safeLoginLink = escapeHtml(loginLink || 'https://yogidesk-ai.com/login');
  const safeTemporaryPassword = escapeHtml(temporaryPassword || '');

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
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
                <p class="text">Hi ${safeEmployeeName}, your administrator has invited you to join their healthcare workspace on Yogi Desk AI. You can now access the team inbox and patient management tools.</p>
                <div class="creds-box">
                    <div class="cred-item"><strong>Login URL:</strong> ${safeLoginLink}</div>
                    <div class="cred-item"><strong>Temporary Password:</strong> ${safeTemporaryPassword}</div>
                </div>
                <p class="text" style="font-size: 13px; font-style: italic;">For security reasons, please update your password immediately after your first login.</p>
                <a href="${safeLoginLink}" class="cta-button">Access Workspace</a>
                <div class="footer">This is an automated invitation from Yogi Desk AI.</div>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = { getWelcomeEmailHTML, getInviteEmailHTML };
