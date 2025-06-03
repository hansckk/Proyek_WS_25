// routes/media.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Media = require('../models/Media'); // Assuming your Media model is here
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/authenticate'); // <--- IMPORT MIDDLEWARE

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
      // This error will be caught by multer's error handling or the fileFilter
      return cb(new Error('customFilename field is required in the request body.'), null);
    }

    // Sanitize filename to prevent directory traversal and invalid characters
    desiredBaseFilename = desiredBaseFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');

    const finalFilename = desiredBaseFilename + originalExtension;
    const fullPath = path.join('uploads/', finalFilename);

    // Check if file exists
    fs.access(fullPath, fs.constants.F_OK, (err) => {
      if (!err) {
        // File exists
        return cb(new Error(`File named '${finalFilename}' already exists. Please choose a different customFilename.`), null);
      }
      // File does not exist, proceed with this filename
      cb(null, finalFilename);
    });
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // This check is now crucial before multer tries to process the file
    if (!req.body.customFilename || req.body.customFilename.trim() === '') {
      // Reject the file and pass an error
      return cb(new Error('customFilename field is required.'), false);
    }
    // If customFilename is present, accept the file
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // Example: 10MB limit
});

// Apply authenticateToken middleware before the multer middleware and route handler
router.post('/upload', authenticateToken, (req, res) => {
  // Now `req.user` is available from `authenticateToken`

  upload.single('file')(req, res, async function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        return res.status(400).json({ message: `Multer error: ${err.message}` });
      } else if (err.message.includes('customFilename field is required') || err.message.includes('already exists')) {
        // Specific errors from our custom logic
        return res.status(400).json({ message: err.message });
      }
      // An unknown error occurred when uploading.
      console.error("Upload Error:", err);
      return res.status(500).json({ message: 'Error during file upload process.', error: err.message });
    }

    // req.file is the `file` file
    // req.body will hold the text fields, if there were any
    const file = req.file;
    if (!file) {
      // This case should ideally be caught by fileFilter or if no file was sent at all
      return res.status(400).json({ message: 'No file uploaded or customFilename missing.' });
    }

    try {
      const media = new Media({
        filename: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        uploadedBy: req.user.id // <--- STORE THE USER ID
      });

      await media.save();
      res.status(201).json({ message: 'Upload successful', media });
    } catch (dbErr) {
      console.error("Database Save Error:", dbErr);
      // If file was uploaded but DB save failed, you might want to delete the orphaned file
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting orphaned file:", unlinkErr);
      });
      res.status(500).json({ message: 'Server error while saving media info.', error: dbErr.message });
    }
  });
});

module.exports = router;