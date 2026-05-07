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
    try {
        const { name, category, language, body, header } = req.body;

        if (!name || !category || !language || !body) {
            return res.status(400).json({ message: 'Missing required fields: name, category, language, body' });
        }

        const components = [
            {
                type: 'BODY',
                text: body
            }
        ];

        if (header && header.text) {
            components.unshift({
                type: 'HEADER',
                format: 'TEXT',
                text: header.text
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