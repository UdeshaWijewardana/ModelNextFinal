const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Agency = require('../models/Agency');
const bcrypt = require('bcryptjs');
const { databaseUnavailable } = require('../middleware/requireDatabase');
const { USER_SESSION_COOKIE, cookieOptions, issueUserSession } = require('../utils/sessionCookies');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
  }
});

const upload = multer({ storage: storage });

router.get('/', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const agencies = await Agency.find({ approvalStatus: 'approved' }).select('agencyName ownerName address profileImage coverImage').sort({ createdAt: -1 });
  return res.json({ agencies });
});

router.post('/register', upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const uploadedFiles = Object.values(req.files || {}).flat();
      await Promise.all(uploadedFiles.map((file) => fs.promises.unlink(file.path).catch(() => undefined)));
      return databaseUnavailable(res);
    }
    if (!process.env.JWT_SECRET) {
      const uploadedFiles = Object.values(req.files || {}).flat();
      await Promise.all(uploadedFiles.map((file) => fs.promises.unlink(file.path).catch(() => undefined)));
      return res.status(503).json({ error: 'User authentication is not configured.' });
    }

    const { agencyName, ownerName, phone, email, address, businessId, password } = req.body;
    
    // In a real application, you should hash the password before saving!
    const newAgency = new Agency({
      agencyName,
      ownerName,
      phone,
      email,
      address,
      businessId,
      password: await bcrypt.hash(password, 12),
      profileImage: req.files['profileImage'] ? req.files['profileImage'][0].path : null,
      coverImage: req.files['coverImage'] ? req.files['coverImage'][0].path : null
    });

    await newAgency.save();
    res.cookie(USER_SESSION_COOKIE, issueUserSession(newAgency, 'agency'), cookieOptions());
    res.status(201).json({ message: "Agency registered successfully", agency: { id: newAgency._id, agencyName: newAgency.agencyName, email: newAgency.email } });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
