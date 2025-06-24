const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'proyek_ws_25',
    });

    console.log('✅ Connected to proyek_ws_25!');
  } catch (err) {
    console.error('❌ Failed to connect:', err.message);
    process.exit(1);
  }
};


const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    console.log("Database disconnected successfully!");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
};

module.exports = { connectDatabase, disconnectDatabase };
