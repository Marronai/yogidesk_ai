// FILE: backend/seeder.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Humara User Model
const connectDB = require('./db'); // Database Connector

// Config load karo
dotenv.config();

// Database se connect karo
connectDB();

const importData = async () => {
  try {
    // 1. Pehle purana kachra saaf karo (Optional)
    await User.deleteMany();
    console.log('🧹 Old Data Destroyed...');

    // 2. Password encrypt karo
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt); // Password: 123456

    // 3. Admin User ka data
    const adminUser = new User({
      name: "Super Admin",
      email: "admin@example.com",
      password: hashedPassword,
      role: "admin",
      planType: "elite", // Elite plan taaki hum testing kar sakein
      parentId: null
    });

    // 4. Save karo
    await adminUser.save();

    console.log('✅ Master Admin Created!');
    console.log('📧 Email: admin@example.com');
    console.log('🔑 Password: 123456');

    process.exit();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Function chalao
importData();