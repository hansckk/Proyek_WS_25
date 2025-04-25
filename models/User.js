const { required } = require("joi");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  age: { type: Number, required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
  api_key: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
