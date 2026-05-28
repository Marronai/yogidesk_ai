const axios = require('axios');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const crypto = require('crypto');

// Ensure upload folder exists
const paymentProofFolder = path.join(__dirname, '../uploads/payment-proof');
if (!fs.existsSync(paymentProofFolder)) {
  fs.mkdirSync(paymentProofFolder, { recursive: true });
}

// 1. Create Payment Order
exports.createOrder = async (req, res) => {
    try {
        // 🛡️ Safety Check: Agar .env se URL nahi mila toh default sandbox use karo
        const baseUrl = process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg";
        
        // 🔍 Debugging: Yeh line terminal mein URL print karegi
        console.log("Connecting to Cashfree at:", baseUrl);

        const { amount } = req.body;
        const user = req.user;

        const response = await axios.post(`${baseUrl}/orders`, {
            order_amount: amount,
            order_currency: "INR",
            order_id: `order_${Date.now()}`,
            customer_details: {
                customer_id: user._id.toString(),
                customer_email: user.email,
                customer_phone: "9999999999" 
            }
        }, {
            headers: {
                'x-client-id': process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET_KEY,
                'x-api-version': '2023-08-01'
            }
        });

        res.status(200).json(response.data);
    } catch (err) {
        // terminal mein detail mein error dikhega
        console.error("Cashfree Error:", err.response?.data || err.message);
        res.status(500).json({ msg: "Internal Server Error" });
    }
};

// 2. Upload UPI payment proof for manual activation
exports.uploadPaymentProof = async (req, res) => {
    try {
        const user = req.user;
        if (!req.file) {
            return res.status(400).json({ msg: 'Please upload a valid screenshot or receipt.' });
        }

        user.paymentProof = req.file.path;
        user.subscriptionStatus = 'pending_payment';
        user.paymentProofStatus = 'pending';
        await user.save();

        return res.status(200).json({ msg: 'Payment proof uploaded successfully. We will verify and activate your account shortly.' });
    } catch (err) {
        console.error('Payment proof upload error:', err.message);
        res.status(500).json({ msg: 'Failed to upload payment proof.' });
    }
};

// 3. Verify Payment (Webhook/Return)
exports.verifyPayment = async (req, res) => {
    try {
        const { order_id } = req.body;

        // Cashfree se order status mangwao
        const response = await axios.get(`${process.env.CASHFREE_BASE_URL}/orders/${order_id}`, {
            headers: {
                'x-client-id': process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET_KEY,
                'x-api-version': '2023-08-01'
            }
        });

        if (response.data.order_status === 'PAID') {
            // 🔥 SUCCESS: Plan Update Logic
            const user = await User.findOne({ email: response.data.customer_details.customer_email });
            
            const paidAt = new Date();
            user.subscriptionStatus = 'active';
            user.isSubscribed = true;
            user.subscriptionStartDate = paidAt;
            user.amountPaid = response.data.order_amount || user.amountPaid || 0;
            // Aaj ki date se 30 din aage ki expiry set karo
            user.planExpiryDate = new Date(+paidAt + 30*24*60*60*1000); 
            
            await user.save();
            return res.status(200).json({ msg: "Payment Verified & Plan Activated!" });
        }

        res.status(400).json({ msg: "Payment not completed" });
    } catch (err) {
        res.status(500).json({ msg: "Verification Error" });
    }
};
