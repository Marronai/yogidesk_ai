require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Yogi Desk API',
    audience: 'Doctors and Clinics',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Yogi Desk API running on port ${PORT}`);
});

// ====== META WEBHOOK ENDPOINTS ======

// 1. GET Method: Meta Dashboard se Verification ke liye
app.get('/api/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Humne .env mein jo token rakha hai (YogiDesk_Doctor_Secure_2026) usse match karenge
    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            console.log('✅ Meta Webhook Verified Successfully!');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ Webhook Verification Failed: Token Mismatch');
            return res.sendStatus(403);
        }
    }
});

// 2. POST Method: Jab Patient WhatsApp par button dabayega, toh data yahan aayega
app.post('/api/webhook/meta', async (req, res) => {
    try {
        const body = req.body;

        // Check karein ki kya ye ek asali WhatsApp message event hai
        if (body.object && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messageData = body.entry[0].changes[0].value.messages[0];
            const patientPhone = messageData.from; // Patient ka WhatsApp number

            // Log entry backup ke liye Supabase mein turant daalein
            console.log(`📩 Message received from ${patientPhone}`);

            // Agar patient ne hamare bheje huye message ka BUTTON click kiya hai
            if (messageData.type === 'button') {
                const buttonPayload = messageData.button.payload; // 'CONFIRM_SLOT' ya 'CANCEL_SLOT'
                const buttonText = messageData.button.text;

                console.log(`🔘 Patient clicked: ${buttonText} (Payload: ${buttonPayload})`);

                // Step 3.1.1: Supabase ke whatsapp_logs table mein event save karein
                await supabase.from('whatsapp_logs').insert([
                    { 
                        patient_phone: patientPhone, 
                        button_payload: buttonPayload, 
                        raw_response: body 
                    }
                ]);

                // Step 3.1.2: Automation Logic - Database mein Appointment Status update karna
                let newStatus = buttonPayload === 'CONFIRM_SLOT' ? 'Confirmed' : 'Cancelled';

                // Hum patients table se check karenge ki ye kis doctor ka patient hai
                const { data: patient } = await supabase
                    .from('patients')
                    .select('id')
                    .eq('phone_number', patientPhone)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (patient) {
                    // Appointment table mein status change kar do
                    await supabase
                        .from('appointments')
                        .update({ status: newStatus })
                        .eq('patient_id', patient.id)
                        .eq('status', 'Confirmed'); // Jo active appointment hai use hi update karein
                    
                    console.log(`🔄 DB Status updated to: ${newStatus} for Patient Phone: ${patientPhone}`);
                }
            }
        }

        // Meta ko hamesha 200 OK dena padta hai, nahi toh wo bar-bar event bhejta rahega
        res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('❌ Webhook Processing Error:', error.message);
        res.status(200).send('EVENT_RECEIVED'); // Keep 200 to prevent Meta from retrying continuously
    }
});

// ==================== STEP 3: META WEBHOOK CHANNELS ====================

// 1. GET ROUTE: Meta Developer Portal isse check karega ki aapka domain taiyar hai ya nahi
app.get('/api/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // .env waale token (YogiDesk_Doctor_Secure_2026) se match check karein
    if (mode && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Meta Webhook Verified on Live Domain!');
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

// 2. POST ROUTE: Jab live WhatsApp par patient "Confirm" ya "Cancel" dabayega, toh hit yahan aayega
app.post('/api/webhook/meta', async (req, res) => {
    const body = req.body;

    // Check karo ki kya ye WhatsApp message ka event hai
    if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const messageData = body.entry[0].changes[0].value.messages[0];
        const patientPhone = messageData.from; // Patient ka no.

        // Agar patient ne Quick Reply BUTTON dabaaya hai
        if (messageData.type === 'button') {
            const buttonPayload = messageData.button.payload; // 'CONFIRM_SLOT' ya 'CANCEL_SLOT'
            
            // Status taiyar karo
            let newStatus = buttonPayload === 'CONFIRM_SLOT' ? 'Confirmed' : 'Cancelled';

            // Supabase real-time update logic
            // Pehle patient ki ID nikaalo phone se
            const { data: patient } = await supabase
                .from('patients')
                .select('id')
                .eq('phone_number', patientPhone)
                .single();

            if (patient) {
                // Appointments table mein status turant change kar do
                await supabase
                    .from('appointments')
                    .update({ status: newStatus })
                    .eq('patient_id', patient.id);
                
                console.log(`🔄 Supabase Updated: Patient ${patientPhone} status is now ${newStatus}`);
            }
        }
    }
    
    // Meta ko 200 OK bhej do taaki wo data baar-baar na bhejta rahe
    res.status(200).send('EVENT_RECEIVED');
});