const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemId: String,
  name: String,
  type: String,
  effect: String,
  price: Number,
  stock: Number,
  rarity: String,
  label: { type: String },
  
});

module.exports = mongoose.model('Item', itemSchema);
