const mongoose = require('mongoose');

// Helper to encode password in MongoDB URI
const encodeMongoPassword = (uri) => {
  // Parse the URI to extract and encode the password
  const url = new URL(uri);
  if (url.password) {
    url.password = encodeURIComponent(url.password);
  }
  return url.toString();
};

// Helper to mask password for logging
const maskPassword = (uri) => {
  return uri.replace(/:([^:@]{1,}):/, ':*****:');
};

const connectDB = async () => {
  let mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error('❌ MONGO_URI not found in .env. Using hardcoded test URI for debugging...');
    // Manual Override: Hardcoded test connection string
    try {
      const testURI = "mongodb+srv://testuser:testpass@cluster0.example.mongodb.net/testdb?retryWrites=true&w=majority";
      const conn = await mongoose.connect(testURI);
      console.log(`✅ Test MongoDB Connected: ${conn.connection.host}`);
      return; // Exit if test succeeds
    } catch (testError) {
      console.error('❌ Test connection also failed:', testError);
      process.exit(1);
    }
  }

  // Encode password to handle special characters
  mongoURI = encodeMongoPassword(mongoURI);

  // Debug logging: Print URI with masked password
  console.log(`🔍 Attempting MongoDB connection to: ${maskPassword(mongoURI)}`);

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database Connection Failed:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    console.error('Full Error Object:', error);
    process.exit(1);
  }
};

module.exports = connectDB;