const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemId: String,
  name: String,
  type: String,
  effect: String,
  price: Number,
  stock: Number,
  rarity: String,
});

module.exports = mongoose.model('Item', itemSchema);
