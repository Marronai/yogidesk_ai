const axios = require('axios');

// 1. Send Test Message Function
exports.sendTestMessage = async (req, res) => {
    try {
        const { phoneNumber } = req.body; // User ka number (e.g., 919876543210)

        // URL Structure: https://graph.facebook.com/v17.0/{PHONE_ID}/messages
        const url = `https://graph.facebook.com/v17.0/${process.env.META_PHONE_ID}/messages`;

        const data = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "template",
            template: {
                name: "hello_world", // Meta ka default test template
                language: { code: "en_US" }
            }
        };

        const config = {
            headers: {
                'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        // API Call
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
    try { // Added footer and buttons
        const { name, category, language, body, header, footer, buttons } = req.body;

        if (!name || !category || !language || !body) {
            return res.status(400).json({ message: 'Missing required fields: name, category, language, body' });
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

        const url = `https://graph.facebook.com/v19.0/${process.env.META_WABA_ID}/message_templates`;
        const data = {
            name: name.trim(),
            language,
            category,
            components
        };

        const config = {
            headers: {
                'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(url, data, config);
        
        // Save to DB
        const Template = require('../models/Template');
        const newTemplate = await Template.create({
            name: name.trim(),
            bodyText: body,
            // Assuming we only save the submitted language's body for now
            // If multi-language storage is needed, the Template model needs to be updated
            // english: body, hinglish: '', hindi: '',
            headerType: header ? 'TEXT' : 'NONE',
            headerText: header ? header.text : '',
            category,
            status: 'PENDING',
            metaTemplateId: response.data.id,
            businessId: req.user.id
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