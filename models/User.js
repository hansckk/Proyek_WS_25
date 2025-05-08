const { required } = require("joi");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  age: { type: Number, required: true },
  role: {
    role_name: { type: String, default: "Free" },
    pokemon_storage: { type: Number, default: 10 },
  },
  pokeDollar: { type: Number, required: true },
  refresh_token: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
});

const User = mongoose.model("users", userSchema);
module.exports = User;
