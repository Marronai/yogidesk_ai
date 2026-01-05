const Patient = require('../models/Patient');
const User = require('../models/User');
const { decrypt } = require('../utils/cryptoUtils'); // ✅ Token decrypt karne ke liye
const axios = require('axios');

// 1. Admit New Patient
exports.admitPatient = async (req, res) => {
    try {
        const patient = new Patient({ ...req.body, user: req.user.id });
        await patient.save();
        res.json({ msg: "Patient Admitted Successfully", patient });
    } catch (err) {
        res.status(500).json({ msg: "Server Error" });
    }
};

// 2. Discharge & Send Feedback (The Trigger ⚡)
exports.dischargePatient = async (req, res) => {
    try {
        const { patientId } = req.body;
        const patient = await Patient.findById(patientId);
        const hospital = await User.findById(req.user.id);

        if (!patient) return res.status(404).json({ msg: "Patient not found" });

        // A. Update Status
        patient.status = 'discharged';
        patient.dischargeDate = Date.now();
        await patient.save();

        // B. WhatsApp Automation Logic
        if (hospital.whatsappConfig.isConfigured) {
            // 🛡️ Security: Token ko decrypt karke asli banana
            const decryptedToken = decrypt(hospital.whatsappConfig.accessToken);
            const phoneId = hospital.whatsappConfig.phoneNumberId;

            const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
            
            // Meta Template Call
            await axios.post(url, {
                messaging_product: "whatsapp",
                to: patient.phone,
                type: "template",
                template: {
                    name: "patient_feedback", // ⚠️ Ye template Meta par approved hona chahiye
                    language: { code: "en_US" },
                    components: [{
                        type: "body",
                        parameters: [{ type: "text", text: patient.name }]
                    }]
                }
            }, {
                headers: { 'Authorization': `Bearer ${decryptedToken}` }
            });
        }

        // C. Email Automation (Placeholder - Iska kaam Phase 4 mein karenge)
        console.log(`📧 Email sent to ${patient.email}: Hope you are feeling better!`);

        res.json({ msg: "Patient Discharged and Feedback Sent! 🎉" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Automation Failed", error: err.message });
    }
};