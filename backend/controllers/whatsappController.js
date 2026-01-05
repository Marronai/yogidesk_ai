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