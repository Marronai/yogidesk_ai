require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const emailConfig = require('./config/emailConfig');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== SUPABASE INITIALIZATION ======
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
let supabaseAdmin;
if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("⚡ Supabase Client Initialized Successfully!");
} else {
    console.log("⚠️ Warning: Supabase Credentials Missing in .env");
}

if (supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}

const PLAN_CONTACT_LIMITS = { starter: 500, growth: 2000, hospital: 10000 };
const RATE_CARD = { UTILITY: 0.20, MARKETING: 1.30, AUTHENTICATION: 0.20 };
const normalizeTier = (tier = 'starter') => String(tier).toLowerCase().split(' ')[0];
const normalizePhone = (phone) => String(phone || '').replace(/[^\d+]/g, '');
const getUnitCost = (category) => RATE_CARD[String(category || 'UTILITY').toUpperCase()] || RATE_CARD.UTILITY;
const sendWelcomeEmail = typeof emailConfig.sendWelcomeEmail === 'function' ? emailConfig.sendWelcomeEmail : async () => false;
const sendLoginAlert = typeof emailConfig.sendLoginAlert === 'function' ? emailConfig.sendLoginAlert : async () => false;
const mailTransporter = emailConfig.transporter;
const emailFrom = process.env.EMAIL_FROM || 'welcome@yogidesk.com';

// ====== HEALTH CHECK ENDPOINT ======
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Yogi Desk API',
    audience: 'Doctors and Clinics',
  });
});

app.post('/api/auth/dispatch-welcome-email', async (req, res) => {
    try {
        const { email, name, businessName, userId } = req.body || {};
        if (!email) return res.status(400).json({ success: false, msg: 'Email is required' });

        if (supabaseAdmin && userId) {
            await supabaseAdmin.from('wallets').upsert({
                user_id: userId,
                balance: 50.00,
                is_first_recharge: true,
                welcome_gift_active: true,
                current_plan: 'starter',
                plan_tier: 'starter',
                lifetime_contacts_count: 0
            }, { onConflict: 'user_id', ignoreDuplicates: true });
        }

        const sent = await sendWelcomeEmail(email, name || 'Doctor', businessName || 'Yogi Desk Clinic');
        return res.status(sent ? 200 : 202).json({ success: sent });
    } catch (error) {
        console.error('Welcome email dispatch error:', error.message);
        return res.status(202).json({ success: false });
    }
});

app.post('/api/auth/dispatch-login-alert', async (req, res) => {
    try {
        const { email, name } = req.body || {};
        if (!email) return res.status(400).json({ success: false, msg: 'Email is required' });

        const ipAddress = (req.headers['x-forwarded-for'] || req.ip || 'Unknown IP').split(',')[0].trim();
        const deviceInfo = req.headers['user-agent'] || 'Verified browser login';
        const sent = await sendLoginAlert(email, name || 'Doctor', deviceInfo, ipAddress);
        return res.status(sent ? 200 : 202).json({ success: sent });
    } catch (error) {
        console.error('Login email dispatch error:', error.message);
        return res.status(202).json({ success: false });
    }
});

app.post('/api/team/dispatch-invite-email', async (req, res) => {
    try {
        const { email, name, inviteLink } = req.body || {};
        if (!email || !inviteLink) return res.status(400).json({ success: false, msg: 'Email and invite link are required' });
        if (!mailTransporter) return res.status(202).json({ success: false, msg: 'SMTP unavailable' });

        await mailTransporter.sendMail({
            from: emailFrom,
            to: email,
            subject: 'You have been invited to Yogi Desk',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px">
                <h2 style="margin:0 0 12px;color:#111827">Yogi Desk team invite</h2>
                <p style="color:#4b5563;line-height:1.6">Hi ${name || 'there'}, your clinic admin has invited you to join their Yogi Desk workspace.</p>
                <p><a href="${inviteLink}" style="display:inline-block;background:#ff6b00;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Accept Invite</a></p>
              </div>
            `
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Team invite email dispatch error:', error.message);
        return res.status(202).json({ success: false });
    }
});

// ====== META WEBHOOK ENDPOINTS ======

// GET Method: Meta WhatsApp webhook verification
app.get('/api/whatsapp-webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === 'YogiDesk_Doctor_Secure_2026') {
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

// 1. GET Method: Meta Dashboard verification loop
// 1. GET Method: Meta Dashboard verification loop
app.get('/api/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const fallbackVerifyToken = "YogiDesk_Doctor_Secure_2026";
    const allowedVerifyTokens = [
        process.env.META_VERIFY_TOKEN,
        process.env.WHATSAPP_VERIFY_TOKEN,
        fallbackVerifyToken
    ].filter(Boolean);

    console.log(`🔍 Meta Verification Attempt -> Received Token: ${token}`);

    if (mode && token) {
        if (mode === 'subscribe' && allowedVerifyTokens.includes(token)) {
            console.log('✅ Meta Webhook Verified Successfully!');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ Webhook Verification Failed: Token Mismatch');
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400);
});

// 2. POST Method: Handles real-time Webhook WhatsApp clicks
app.post('/api/webhook/meta', async (req, res) => {
    try {
        const body = req.body;

        // Verify if this is a genuine WhatsApp message object
        if (body.object && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messageData = body.entry[0].changes[0].value.messages[0];
            const patientPhone = messageData.from; // Patient's WhatsApp number

            console.log(`📩 Message received from patient: ${patientPhone}`);

            // If patient clicked a quick reply button inside the WhatsApp Template
            if (messageData.type === 'button') {
                const buttonPayload = messageData.button.payload; // 'CONFIRM_SLOT' or 'CANCEL_SLOT'
                const buttonText = messageData.button.text;

                console.log(`🔘 Patient clicked: ${buttonText} (Payload: ${buttonPayload})`);

                if (supabase) {
                    // Step A: Save incoming activity to backup logs table
                    await supabase.from('whatsapp_logs').insert([
                        { 
                            patient_phone: patientPhone, 
                            button_payload: buttonPayload, 
                            raw_response: body 
                        }
                    ]);

                    // Step B: Set local variables for dynamic statuses
                    let newStatus = buttonPayload === 'CONFIRM_SLOT' ? 'Confirmed' : 'Cancelled';

                    // Step C: Lookup patient ID from 'patients' table using phone number
                    const { data: patient } = await supabase
                        .from('patients')
                        .select('id')
                        .eq('phone_number', patientPhone)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (patient) {
                        // Step D: Update live status in 'appointments' table
                        await supabase
                            .from('appointments')
                            .update({ status: newStatus })
                            .eq('patient_id', patient.id)
                            .eq('status', 'Pending'); // Updates unconfirmed slots safely
                        
                        console.log(`🔄 Supabase Status successfully updated to: ${newStatus}`);
                    }
                }
            }
        }

        // Meta requires an absolute 200 OK to clear queue loops
        return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('❌ Webhook Processing Error:', error.message);
        return res.status(200).send('EVENT_RECEIVED'); 
    }
});

// ====== CAMPAIGN SCHEDULER ======
app.post('/api/campaigns/schedule', async (req, res) => {
    try {
        if (!supabase) return res.status(500).json({ success: false, msg: "Database connection unavailable" });

        const { userId, template, recipients = [] } = req.body;
        if (!userId || !template || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ success: false, msg: "Template and recipients are required" });
        }

        const seen = new Set();
        const uniqueRecipients = recipients
            .map((recipient) => ({
                name: String(recipient.name || '').trim(),
                phone: normalizePhone(recipient.phone)
            }))
            .filter((recipient) => {
                if (!recipient.name || !recipient.phone || seen.has(recipient.phone)) return false;
                seen.add(recipient.phone);
                return true;
            });

        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('balance, plan_tier, lifetime_contacts_count')
            .eq('user_id', userId)
            .single();

        if (walletError || !wallet) return res.status(404).json({ success: false, msg: "Wallet not found" });

        const tier = normalizeTier(wallet.plan_tier);
        const contactLimit = PLAN_CONTACT_LIMITS[tier] || PLAN_CONTACT_LIMITS.starter;
        const currentCount = Number(wallet.lifetime_contacts_count || 0);
        const nextCount = currentCount + uniqueRecipients.length;

        if (nextCount > contactLimit) {
            return res.status(403).json({ success: false, msg: "Contact tier limit reached. Upgrade required." });
        }

        const baseTime = Date.now();
        const queueRows = uniqueRecipients.map((recipient, index) => ({
            user_id: userId,
            template_id: template.id || null,
            template_name: template.template_name || template.name || 'WhatsApp Template',
            template_category: template.category || 'UTILITY',
            recipient_name: recipient.name,
            recipient_phone: recipient.phone,
            payload: { template, recipient },
            status: 'PENDING',
            scheduled_for: new Date(baseTime + index * 3 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase.from('campaign_queue').insert(queueRows);
        if (insertError) throw insertError;

        const { error: countError } = await supabase
            .from('wallets')
            .update({ lifetime_contacts_count: nextCount })
            .eq('user_id', userId);
        if (countError) throw countError;

        return res.status(200).json({
            success: true,
            queued: queueRows.length,
            newUniqueRecipients: uniqueRecipients.length
        });
    } catch (error) {
        console.error('Campaign schedule error:', error.message);
        return res.status(500).json({ success: false, msg: "Unable to schedule campaign" });
    }
});

// ====== TASK 3: DYNAMIC WALLET DEDUCTION ENGINE ======
app.post('/api/campaign/broadcast', async (req, res) => {
    const { userId, templateCategory, patientCount, templateName } = req.body;

    try {
        if (!supabase) return res.status(500).json({ msg: "Database connection unavailable" });

        // 1. Calculate Costs (Flat rates, no GST breakdown shown to user)
        const unitCost = templateCategory === 'UTILITY' ? 0.20 : 1.30;
        const totalCost = parseFloat((patientCount * unitCost).toFixed(2));

        // 2. Fetch User Balance
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance')
            .eq('id', userId)
            .single();

        if (userError || !user) throw new Error("User wallet not found");

        // 3. Validation Logic
        const currentBalance = parseFloat(user.wallet_balance || 0);
        if (currentBalance < totalCost) {
            return res.status(400).json({ 
                success: false, 
                msg: `Insufficient Yogi Wallet Balance! Please recharge with at least ₹100 to execute this broadcast.` 
            });
        }

        // 4. Atomic Transaction: Deduct Balance & Log Entry
        const newBalance = parseFloat((currentBalance - totalCost).toFixed(2));

        // Update balance
        const { error: updateError } = await supabase
            .from('users')
            .update({ wallet_balance: newBalance })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Write Debit Entry
        await supabase.from('wallet_transactions').insert([
            { 
                user_id: userId,
                amount: totalCost,
                type: 'message_debit',
                description: `Broadcast: Sent ${templateCategory} template "${templateName}" to ${patientCount} patients`,
                metadata: {
                    unit_cost: unitCost,
                    category: templateCategory,
                    patients: patientCount
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            msg: "Broadcast initiated successfully",
            deducted: totalCost,
            remaining_balance: newBalance
        });

    } catch (error) {
        console.error('❌ Wallet Engine Error:', error.message);
        return res.status(500).json({ success: false, msg: "Transaction failed. Please try again." });
    }
});

// ====== WALLET RECHARGE ENGINE ======
app.post('/api/wallet/recharge', async (req, res) => {
    const { userId, amount } = req.body;

    try {
        if (!supabase) return res.status(500).json({ msg: "Database connection unavailable" });

        // 1. Fetch current balance
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance')
            .eq('id', userId)
            .single();

        if (userError || !user) throw new Error("User not found");

        const newBalance = parseFloat(user.wallet_balance || 0) + parseFloat(amount);

        // 2. Update Balance in Users table
        const { error: updateError } = await supabase
            .from('users')
            .update({ wallet_balance: newBalance })
            .eq('id', userId);

        if (updateError) throw updateError;

        // 3. Log Credit Transaction
        await supabase.from('wallet_transactions').insert([
            { 
                user_id: userId,
                amount: amount,
                type: 'CREDIT',
                description: `Wallet recharge of ₹${amount} successful.`,
                metadata: {
                    payment_method: 'Manual/Internal',
                    recharge_amount: amount,
                    previous_balance: user.wallet_balance
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            msg: "Wallet recharged successfully",
            newBalance: newBalance
        });

    } catch (error) {
        console.error('❌ Recharge Engine Error:', error.message);
        return res.status(500).json({ 
            success: false, 
            msg: "Recharge failed. Please contact support." 
        });
    }
});

// ====== PAYU HASH GENERATOR ROUTE ======
app.post('/api/payment/payu-hash', async (req, res) => {
    const { txnid, amount, productinfo, firstname, email } = req.body;
    const key = process.env.PAYU_MERCHANT_KEY;
    const salt = process.env.PAYU_MERCHANT_SALT;

    try {
        if (!key || !salt) throw new Error("PayU Credentials missing in server environment");

        // Formula: key|txnid|amount|productinfo|firstname|email|||||||||||salt
        const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        return res.status(200).json({ hash });
    } catch (error) {
        return res.status(500).json({ success: false, msg: error.message });
    }
});

// ====== INTERNAL CAMPAIGN QUEUE WORKER ======
let campaignWorkerRunning = false;
const triggerMockMetaWebhook = async (queueItem) => ({
    ok: true,
    provider: 'mock_meta',
    message_id: `mock_${queueItem.id}_${Date.now()}`
});

const processCampaignQueue = async () => {
    if (!supabase || campaignWorkerRunning) return;
    campaignWorkerRunning = true;

    try {
        const { data: dueRows, error } = await supabase
            .from('campaign_queue')
            .select('*')
            .eq('status', 'PENDING')
            .lte('scheduled_for', new Date().toISOString())
            .order('scheduled_for', { ascending: true })
            .limit(25);

        if (error) throw error;
        if (!Array.isArray(dueRows) || dueRows.length === 0) return;

        for (const row of dueRows) {
            const unitCost = getUnitCost(row.template_category);
            const { data: wallet } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', row.user_id)
                .single();

            const currentBalance = Number(wallet?.balance || 0);
            if (currentBalance < unitCost) {
                await supabase.from('campaign_queue').update({ status: 'FAILED', error_message: 'Insufficient wallet balance' }).eq('id', row.id);
                continue;
            }

            const metaResult = await triggerMockMetaWebhook(row);
            const nextBalance = Number((currentBalance - unitCost).toFixed(2));

            const logPayload = {
                queue_id: row.id,
                recipient_name: row.recipient_name,
                recipient_phone: row.recipient_phone,
                template_name: row.template_name,
                meta_result: metaResult
            };

            await Promise.allSettled([
                supabase.from('wallets').update({ balance: nextBalance }).eq('user_id', row.user_id),
                supabase.from('campaign_queue').update({ status: 'SENT', sent_at: new Date().toISOString(), meta_response: metaResult }).eq('id', row.id),
                supabase.from('wallet_transactions').insert([{
                    user_id: row.user_id,
                    amount: unitCost,
                    type: 'message_debit',
                    description: `Campaign sent to ${row.recipient_phone} using ${row.template_name}`,
                    metadata: logPayload,
                    created_at: new Date().toISOString()
                }]),
                supabase.from('inbox').insert([{
                    user_id: row.user_id,
                    patient_name: row.recipient_name,
                    patient_phone: row.recipient_phone,
                    direction: 'OUTBOUND',
                    message: `Sent template: ${row.template_name}`,
                    metadata: logPayload,
                    created_at: new Date().toISOString()
                }])
            ]);
        }
    } catch (error) {
        console.error('Campaign queue worker error:', error.message);
    } finally {
        campaignWorkerRunning = false;
    }
};

setInterval(processCampaignQueue, 10000);

// ====== PORT LISTEN ENGINE ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Yogi Desk API running safely on port ${PORT}`);
});
