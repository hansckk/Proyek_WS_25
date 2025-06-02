// routes/media.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Media = require('../models/Media');
const path = require('path');
const fs = require('fs'); 

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const originalExtension = path.extname(file.originalname);
    let desiredBaseFilename = '';

   if (req.body.customFilename && req.body.customFilename.trim() !== '') {
      desiredBaseFilename = req.body.customFilename.trim().replace(/\.[^/.]+$/, "");
    } else {
     return cb(new Error('customFilename field is required in the request body.'), null);
    }

    desiredBaseFilename = desiredBaseFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');

    const finalFilename = desiredBaseFilename + originalExtension;

    const fullPath = path.join('uploads/', finalFilename);
    fs.access(fullPath, fs.constants.F_OK, (err) => {
      if (!err) {
        return cb(new Error(`File named '${finalFilename}' already exists. Please choose a different customFilename.`), null);
      }
      cb(null, finalFilename);
    });
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!req.body.customFilename || req.body.customFilename.trim() === '') {
     return cb(new Error('customFilename field is required.'), false);
    }
    cb(null, true);
  }
});

router.post('/upload', (req, res) => {
 upload.single('file')(req, res, async function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Multer error: ${err.message}` });
      } else if (err.message.includes('customFilename field is required') || err.message.includes('already exists')) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Upload Error:", err);
      return res.status(500).json({ message: 'Error during file upload process.', error: err.message });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded or customFilename missing.' });
    }

    try {
      const media = new Media({
        filename: file.filename, 
         path: file.path,
        mimetype: file.mimetype,
        size: file.size
      });

      await media.save();
      res.status(201).json({ message: 'Upload successful', media });
    } catch (dbErr) {
      console.error("Database Save Error:", dbErr);
      res.status(500).json({ message: 'Server error while saving media info.', error: dbErr.message });
    }
  });
});

module.exports = router;