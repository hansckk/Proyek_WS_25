// routes/media.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Media = require('../models/Media'); // Assuming your Media model is here
const User = require('../models/User');   // <--- IMPORT USER MODEL
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/authenticate');

const UPLOAD_DIR = 'uploads/';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
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
    const fullPath = path.join(UPLOAD_DIR, finalFilename);

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
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: File upload only supports the following filetypes - ' + allowedTypes), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /upload - Upload media and optionally set as profile picture
router.post('/upload', authenticateToken, (req, res) => {
  upload.single('file')(req, res, async function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Multer error: ${err.message}` });
      } else if (err.message.includes('customFilename field is required') ||
                 err.message.includes('already exists') ||
                 err.message.includes('File upload only supports')) {
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
        size: file.size,
        uploadedBy: req.user.id
      });
      await media.save();

      // Optionally set as profile picture if a flag is passed
      // For example, if req.body.setAsProfile === 'true'
      if (req.body.setAsProfile === 'true' || req.body.setAsProfile === true) {
        await User.findByIdAndUpdate(req.user.id, { profileImage: media._id });
        res.status(201).json({ message: 'Upload successful and set as profile picture.', media });
      } else {
        res.status(201).json({ message: 'Upload successful.', media });
      }

    } catch (dbErr) {
      console.error("Database Save Error:", dbErr);
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting orphaned file:", unlinkErr);
      });
      res.status(500).json({ message: 'Server error while saving media info.', error: dbErr.message });
    }
  });
});


// --- NEW ROUTE TO GET PROFILE IMAGE ---
// GET /media/profile - Get the authenticated user's profile image
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // From authenticateToken middleware

    // Find the user and populate their profileImage field (which references a Media document)
    const user = await User.findById(userId).populate('profileImage');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.profileImage) {
      // User exists but has not set a profile image
      // You could send a default image or a 404
      return res.status(404).json({ message: 'Profile image not set for this user.' });
    }

    // user.profileImage is now the fully populated Media document
    const media = user.profileImage;

    // Construct the absolute path to the image file
    // path.resolve() is safer than path.join() for creating absolute paths from potentially relative ones
    const imagePath = path.resolve(media.path);

    // Check if the file actually exists on the filesystem
    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error('Profile image file not found on disk:', imagePath, 'for media ID:', media._id);
        // This could indicate an orphaned DB record or a misconfiguration
        return res.status(404).json({ message: 'Profile image file not found on server.' });
      }

      // Set the correct content type and send the file
      res.setHeader('Content-Type', media.mimetype);
      res.sendFile(imagePath, (errSendFile) => {
        if (errSendFile) {
            console.error("Error sending profile image:", errSendFile);
            // Avoid sending another response if headers already sent
            if (!res.headersSent) {
                res.status(500).json({ message: "Error sending profile image." });
            }
        }
      });
    });

  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).json({ message: 'Server error while fetching profile image.' });
  }
});

// Optional: Route to serve any media by its ID (if needed for other purposes)
router.get('/:mediaId', authenticateToken, async (req, res) => {
    try {
        const media = await Media.findById(req.params.mediaId);
        if (!media) {
            return res.status(404).json({ message: 'Media not found.' });
        }

        // Basic check: ensure the logged-in user is the one who uploaded it
        // You might have different authorization rules (e.g., public images)
        if (media.uploadedBy.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this media.' });
        }

        const filePath = path.resolve(media.path);
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                return res.status(404).json({ message: 'File not found on server.' });
            }
            res.setHeader('Content-Type', media.mimetype);
            res.sendFile(filePath);
        });
    } catch (error) {
        console.error("Error fetching media by ID:", error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid media ID format.' });
        }
        res.status(500).json({ message: 'Server error fetching media.' });
    }
});


module.exports = router;