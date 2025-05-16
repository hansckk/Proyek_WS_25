const express = require('express');
const router = express.Router();
const multer = require('multer');
const Media = require('../models/Media');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const media = new Media({
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size
    });

    await media.save();
    res.status(201).json({ message: 'Upload successful', media });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
