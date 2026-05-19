require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const getUserMetaCredentials = async (userId) => {
    if (!supabase || !userId) return {};
    const { data, error } = await supabase
        .from('doctor_profiles')
        .select('whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token')
        .eq('user_id', userId)
        .maybeSingle();
    if (error || !data) {
        if (error) console.warn('Meta credential lookup failed:', error.message);
        return {};
    }
    return {
        phoneNumberId: data.whatsapp_phone_number_id || null,
        businessAccountId: data.whatsapp_business_account_id || null,
        accessToken: data.whatsapp_access_token || null
    };
};

// 1. Send Test Message Function
exports.sendTestMessage = async (req, res) => {
    try {
        const { phoneNumber, userId } = req.body;
        if (!phoneNumber || !userId) {
            return res.status(400).json({ success: false, msg: 'phoneNumber and userId are required' });
        }

        const credentials = await getUserMetaCredentials(userId);
        const phoneId = credentials.phoneNumberId || process.env.META_PHONE_ID;
        const accessToken = credentials.accessToken || process.env.META_ACCESS_TOKEN;

        if (!phoneId || !accessToken) {
            return res.status(500).json({ success: false, msg: 'WhatsApp Meta credentials are unavailable for this user.' });
        }

        const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
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
            userId,
            name,
            category,
            language,
            body,
            header,
            footer,
            buttons,
            messaging_product: messagingProduct = 'whatsapp',
            whatsapp_business_account_id: requestBusinessAccountId,
            whatsapp_access_token: requestAccessToken
        } = req.body;

        if (!userId || !name || !category || !language || !body) {
            return res.status(400).json({ message: 'Missing required fields: userId, name, category, language, body' });
        }

        const credentials = await getUserMetaCredentials(userId);
        const businessAccountId = requestBusinessAccountId || credentials.businessAccountId || process.env.META_WABA_ID;
        const accessToken = requestAccessToken || credentials.accessToken || process.env.META_ACCESS_TOKEN;

        if (!businessAccountId || !accessToken) {
            return res.status(500).json({ message: 'WhatsApp Meta credentials unavailable for this user.' });
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
            businessId: userId
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
