// models/Media.js
const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  path: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  // Add this line:
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Can be made required if every media must have an uploader
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Media', mediaSchema);