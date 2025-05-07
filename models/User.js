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
  api_key: { type: String, required: true },
  api_hit: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
});

const User = mongoose.model("users", userSchema);
module.exports = User;
