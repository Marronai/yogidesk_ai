const User = require('../models/User');
const bcrypt = require('bcryptjs');
const META_CONFIGURATION_LOCKED_MESSAGE = "Configuration locked. Contact Customer Support to modify your Meta integrations.";
const hasLockedMetaConfig = (config = {}) => Boolean(
  String(config.phoneNumberId || '').trim() &&
  String(config.wabaId || '').trim() &&
  String(config.accessToken || '').trim()
);
const { encrypt } = require('../utils/cryptoUtils'); // ✅ Encryption import kiya

exports.updateProfile = async (req, res) => {
  try {
    const { 
      name, 
      businessName, 
      industry, // 🏥 Naya field
      whatsappPhoneNumberId, 
      whatsappWabaId, 
      whatsappAccessToken 
    } = req.body;

    const user = await User.findById(req.user.id);
    const incomingMetaUpdate = Boolean(whatsappPhoneNumberId || whatsappWabaId || whatsappAccessToken);

    if (incomingMetaUpdate && hasLockedMetaConfig(user.whatsappConfig || {})) {
      return res.status(403).json({ msg: META_CONFIGURATION_LOCKED_MESSAGE, message: META_CONFIGURATION_LOCKED_MESSAGE });
    }

    // 1. Basic Details
    if (name) user.name = name;
    if (businessName) user.businessName = businessName;
    if (industry) user.industry = industry;

    // 2. WhatsApp Config (With Security ✨)
    if (whatsappPhoneNumberId) user.whatsappConfig.phoneNumberId = whatsappPhoneNumberId;
    if (whatsappWabaId) user.whatsappConfig.wabaId = whatsappWabaId;
    
    // 🛡️ Token ko encrypt karke hi save karenge
    if (whatsappAccessToken) {
        user.whatsappConfig.accessToken = encrypt(whatsappAccessToken);
        user.whatsappConfig.isConfigured = true;
    }

    await user.save();
    
    // Response mein encrypted token mat bhejna, sirf success message
    res.json({ 
      msg: "Settings updated securely", 
      industry: user.industry 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
};

// changePassword function wahi rahega...

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Old password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();
    res.json({ msg: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
};
