const mongoose = require('mongoose');

const connectDB = async () => {
  // 👇 Yahan apna pura MongoDB URL directly daal dein
  const mongoURI = "mongodb+srv://marroncorpai_db_user:Avinash111@cluster0.bqsqfjx.mongodb.net/?appName=Cluster0";

  try {
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database Connection Failed: ${error.message}`);
    // Server crash na ho isliye exit code hata sakte hain ya rehne dein
    process.exit(1); 
  }
};

module.exports = connectDB;