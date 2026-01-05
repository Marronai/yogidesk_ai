// FILE: backend/routes/teamRoutes.js
const express = require('express');
const router = express.Router();
const { addTeamMember, getTeamMembers, deleteTeamMember } = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');

router.post('/add', protect, addTeamMember);    // Add
router.get('/', protect, getTeamMembers);       // List
router.delete('/delete/:id', protect, deleteTeamMember); // 🔥 Delete Route

module.exports = router;