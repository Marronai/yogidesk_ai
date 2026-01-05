const express = require('express');
const router = express.Router();


// 1. Controller se functions nikalein
// Check karein ki path 'templateController' hai ya 'templatecontroller' (Case-sensitive)
const { createTemplate, getTemplates } = require('../controllers/templateController');

// 2. Auth middleware se functions nikalein
const { protect, adminOnly } = require('../middleware/auth');

// 🔍 Debugging Tip: Agar server crash ho, toh niche wali lines uncomment karke check karein
// console.log("createTemplate:", typeof createTemplate); // 'function' aana chaiye
// console.log("protect:", typeof protect); // 'function' aana chaiye

// Routes
console.log("DEBUG - protect:", typeof protect); 
console.log("DEBUG - getMe:", typeof getMe);
console.log("DEBUG - registerUser:", typeof registerUser);

module.exports = router;