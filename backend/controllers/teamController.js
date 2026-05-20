// FILE: backend/controllers/teamController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { sendDirectBrandMail } = require('../services/mailService');
const { getInviteEmailHTML } = require('../utils/emailTemplates');

// --- 1. ADD MEMBER (Admin & Manager Only) ---
exports.addTeamMember = async (req, res) => {
  try {
    const { name, email, role, password, shiftStart, shiftEnd, canViewAds } = req.body;

    // A. Validation
    if (!name || !email || !role || !password) {
      return res.status(400).json({ msg: "Please enter Name, Email, Password, and Role." });
    }

    // B. Permission Check (Security Layer)
    // Req.user.id logged in banda hai via AuthMiddleware
    const requestor = await User.findById(req.user.id);
    
    // Agar banda 'employee' hai toh wo add nahi kar sakta
    if (requestor.role === 'employee') {
      return res.status(403).json({ msg: "Access Denied: Employees cannot add members." });
    }

    // C. Duplicate Check
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    // D. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // E. Create User (Restore Shift & Ads Fields)
    const newMember = new User({
      name,
      email,
      password: hashedPassword,
      role,
      businessName: requestor.businessName, // Apni hi company me add karega
      businessType: requestor.businessType,
      planType: 'lite',
      // 🔥 RESTORED FIELDS
      settings: { 
        shiftStart: shiftStart || '09:00', 
        shiftEnd: shiftEnd || '18:00',
        canViewAds: canViewAds || false 
      }
    });

    await newMember.save();

    // 📧 Resend Invite Email Injection
    const loginLink = process.env.FRONTEND_URL || 'https://yogidesk-ai.com/login';
    const inviteHTML = getInviteEmailHTML(name, loginLink, password);
    sendDirectBrandMail(email, "You are invited to join Yogi Desk AI Team", inviteHTML, 'system')
      .catch(err => console.error("Resend Mailer Invite Error:", err.message));

    res.json({ msg: "Member Added Successfully", member: newMember });

  } catch (err) {
    console.error("Add Error:", err.message);
    res.status(500).send("Server Error");
  }
};

// --- 2. GET MEMBERS (Sab dekh sakte hain) ---
exports.getTeamMembers = async (req, res) => {
  try {
    const requestor = await User.findById(req.user.id);
    const members = await User.find({ businessName: requestor.businessName });
    res.json(members);
  } catch (err) {
    res.status(500).send("Server Error");
  }
};

// --- 3. DELETE MEMBER (🔥 ADMIN ONLY) ---
exports.deleteTeamMember = async (req, res) => {
  try {
    const memberId = req.params.id;
    const requestor = await User.findById(req.user.id);

    // 🔥 SECURITY: Only Admin can delete
    if (requestor.role !== 'admin') {
      return res.status(403).json({ msg: "Access Denied: Only Admins can delete members." });
    }

    const memberToDelete = await User.findById(memberId);
    if (!memberToDelete) return res.status(404).json({ msg: "User not found" });

    // Ownership Check
    if (memberToDelete.businessName !== requestor.businessName) {
      return res.status(401).json({ msg: "Unauthorized action." });
    }

    await User.findByIdAndDelete(memberId);
    res.json({ msg: "User Deleted Successfully", id: memberId });

  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(500).send("Server Error");
  }
};