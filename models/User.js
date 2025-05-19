const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  age: { type: Number, required: true },
  pokemon_storage: { type: Number, default: 10 },
  items: [
    {
      name:      { type: String },
      type:      { type: String },
      effect:    { type: String },
      price:     { type: Number },
      quantity:  { type: Number },
      rarity:    { type: String },
      label:     { type: String },
    },
  ],
  pokeDollar: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
});

const User = mongoose.model("users", userSchema);
module.exports = User;
