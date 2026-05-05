const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not defined in .env');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (error.name === 'MongoServerError' && error.code === 18) {
      console.error('❌ MongoDB Authentication failed: bad username/password or authSource mismatch.');
    } else if (error.name === 'MongoParseError') {
      console.error('❌ MongoDB Connection string parse error: please verify MONGO_URI format.');
    } else {
      console.error(`❌ MongoDB Connection Error [${error.name}]: ${error.message}`);
    }
    console.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;