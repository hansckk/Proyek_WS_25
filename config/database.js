const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const uri = process.env.MONGODB_URI + "/" + process.env.DB_NAME;

async function connectDatabase() {
  try {
    await mongoose.connect(uri);
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

module.exports = connectDatabase;