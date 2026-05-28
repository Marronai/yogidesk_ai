const express = require('express');
const router = express.Router();
const User = require('../models/User');
const adminMiddleware = require('../middleware/adminMiddleware');

const SUBSCRIPTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const calculateDaysLeft = (subscriptionStartDate) => {
  if (!subscriptionStartDate) return 0;

  const start = new Date(subscriptionStartDate);
  if (Number.isNaN(start.getTime())) return 0;

  const expiry = new Date(start.getTime() + SUBSCRIPTION_DAYS * DAY_MS);
  const daysLeft = Math.ceil((expiry - new Date()) / DAY_MS);
  return daysLeft > 0 ? daysLeft : 0;
};

const getClientStatus = (user, daysLeft) => {
  if (!user.isSubscribed || user.subscriptionStatus === 'suspended' || daysLeft <= 0) {
    return 'Expired';
  }

  if (daysLeft < 3) return 'Expiring Soon';
  return 'Active';
};

const serializeClient = (user) => {
  const paymentDate = user.subscriptionStartDate || user.createdAt;
  const daysLeft = calculateDaysLeft(paymentDate);
  const status = getClientStatus(user, daysLeft);

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    paymentDate,
    amount: user.amountPaid || 0,
    daysLeft,
    isSubscribed: Boolean(user.isSubscribed),
    subscriptionStatus: user.subscriptionStatus,
    status,
  };
};

router.get('/clients-all', adminMiddleware, async (req, res) => {
  try {
    const clients = await User.find({ role: { $nin: ['admin', 'employee'] } })
      .select('name email subscriptionStartDate amountPaid isSubscribed subscriptionStatus createdAt')
      .sort({ createdAt: -1 });

    res.json({ clients: clients.map(serializeClient) });
  } catch (error) {
    console.error('Admin clients fetch error:', error.message);
    res.status(500).json({ msg: 'Failed to load clients.' });
  }
});

router.patch('/clients/:id/access', adminMiddleware, async (req, res) => {
  try {
    const { enabled } = req.body;
    const client = await User.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ msg: 'Client not found.' });
    }

    client.isSubscribed = Boolean(enabled);
    client.subscriptionStatus = enabled ? 'active' : 'suspended';

    if (enabled) {
      client.subscriptionStartDate = new Date();
      client.planExpiryDate = new Date(Date.now() + SUBSCRIPTION_DAYS * DAY_MS);
    } else {
      client.planExpiryDate = new Date();
    }

    await client.save();

    res.json({
      msg: enabled ? 'Client access enabled.' : 'Client access suspended.',
      client: serializeClient(client),
    });
  } catch (error) {
    console.error('Admin access update error:', error.message);
    res.status(500).json({ msg: 'Failed to update client access.' });
  }
});

module.exports = router;
