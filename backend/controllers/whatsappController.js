require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const missingSubAccountConfigResponse = {
    success: false,
    message: "WhatsApp API profile configuration missing for this sub-account."
};

const getActiveDoctorId = (req) => {
    const authUser = req.user || req.auth?.user || req.session?.user || {};
    return (
        authUser.doctor_id ||
        authUser.doctorId ||
        authUser.id ||
        authUser._id?.toString?.() ||
        req.auth?.doctor_id ||
        req.auth?.doctorId ||
        req.session?.doctor_id ||
        req.session?.doctorId ||
        null
    );
};

const getDoctorMetaCredentials = async (doctorId) => {
    if (!supabase || !doctorId) return {};

    const lookupColumns = ['doctor_id', 'id', 'user_id'];
    let data = null;
    let lastError = null;

    for (const column of lookupColumns) {
        const result = await supabase
            .from('doctor_profiles')
            .select('meta_phone_number_id,meta_waba_id')
            .eq(column, doctorId)
            .maybeSingle();

        if (result.data) {
            data = result.data;
            lastError = null;
            break;
        }

        if (result.error) {
            lastError = result.error;
        }
    }

    if (lastError || !data) {
        if (lastError) console.warn('Meta credential lookup failed:', lastError.message);
        return {};
    }

    return {
        phoneNumberId: data.meta_phone_number_id || null,
        businessAccountId: data.meta_waba_id || null,
        accessToken: process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || null
    };
};

// 1. Send Test Message Function
exports.sendTestMessage = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const doctorId = getActiveDoctorId(req);

        if (!phoneNumber) {
            return res.status(400).json({ success: false, msg: 'phoneNumber is required' });
        }

        if (!doctorId) {
            return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        }

        const credentials = await getDoctorMetaCredentials(doctorId);
        const phoneId = credentials.phoneNumberId;
        const accessToken = credentials.accessToken;

        if (!phoneId || !credentials.businessAccountId) {
            return res.status(400).json(missingSubAccountConfigResponse);
        }

        if (!accessToken) {
            return res.status(500).json({ success: false, message: 'WhatsApp API authorization is not configured.' });
        }

        const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
        const data = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'template',
            template: {
                name: 'hello_world',
                language: { code: 'en_US' }
            }
        };

        const config = {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(url, data, config);

        console.log("Message Sent ID:", response.data.messages[0].id);
        res.status(200).json({ 
            success: true, 
            msg: "Message sent successfully!", 
            data: response.data 
        });

    } catch (error) {
        console.error("WhatsApp Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ 
            success: false, 
            msg: "Message failed", 
            error: error.response ? error.response.data : error.message 
        });
    }
};

// 2. Submit Template Function
exports.submitTemplate = async (req, res) => {
    try {
        const {
            name,
            category,
            language,
            body,
            header,
            footer,
            buttons,
            messaging_product: messagingProduct = 'whatsapp'
        } = req.body;
        const doctorId = getActiveDoctorId(req);

        if (!doctorId) {
            return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        }

        if (!name || !category || !language || !body) {
            return res.status(400).json({ success: false, message: 'Missing required fields: name, category, language, body' });
        }

        const credentials = await getDoctorMetaCredentials(doctorId);
        const businessAccountId = credentials.businessAccountId;
        const accessToken = credentials.accessToken;

        if (!credentials.phoneNumberId || !businessAccountId) {
            return res.status(400).json(missingSubAccountConfigResponse);
        }

        if (!accessToken) {
            return res.status(500).json({ success: false, message: 'WhatsApp API authorization is not configured.' });
        }

        const components = [
            {
                type: 'BODY',
                text: body
            }
        ];

        // Handle Header component
        if (header) {
            components.unshift({
                type: 'HEADER',
                format: header.type, // TEXT, IMAGE, VIDEO, DOCUMENT
                ...(header.type === 'TEXT' && { text: header.text }),
                ...(header.type !== 'TEXT' && { example: { header_handle: [header.link] } }) // For media, Meta expects example with link
            });
        }

        // Handle Body component (already added above)

        // Handle Footer component
        if (footer && footer.text) {
            components.push({
                type: 'FOOTER',
                text: footer.text
            });
        }

        // Handle Buttons component
        if (buttons && buttons.length > 0) {
            components.push({
                type: 'BUTTONS',
                buttons: buttons.map(btn => ({
                    type: btn.type === 'URL' ? 'URL' : 'PHONE_NUMBER', // Meta API uses PHONE_NUMBER
                    text: btn.text,
                    ...(btn.type === 'URL' && { url: btn.url }),
                    ...(btn.type === 'PHONE_NUMBER' && { phone_number: btn.phone_number })
                }))
            });
        }

        const url = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;
        const data = {
            messaging_product: messagingProduct || 'whatsapp',
            name: name.trim(),
            language,
            category,
            components
        };

        const config = {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(url, data, config);
        
        // Save to DB
        const Template = require('../models/Template');
        const newTemplate = await Template.create({
            name: name.trim(),
            bodyText: body,
            headerType: header ? 'TEXT' : 'NONE',
            headerText: header ? header.text : '',
            category,
            status: 'PENDING_REVIEW',
            metaTemplateId: response.data.id || response.data.message_template_id,
            businessId: doctorId
        });

        console.log("Template Submitted ID:", response.data.id);
        res.status(200).json({
            success: true,
            message: 'Template submitted successfully',
            data: { ...response.data, dbId: newTemplate._id }
        });

    } catch (error) {
        console.error("Template Submission Error:", error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            message: 'Template submission failed',
            error: error.response ? error.response.data : error.message
        });
    }
};
