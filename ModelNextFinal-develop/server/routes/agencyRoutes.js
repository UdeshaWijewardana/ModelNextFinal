const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Agency = require('../models/Agency');

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

router.post('/register', upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
  try {
    const { agencyName, ownerName, phone, email, address, businessId, password } = req.body;
    
    // In a real application, you should hash the password before saving!
    const newAgency = new Agency({
      agencyName,
      ownerName,
      phone,
      email,
      address,
      businessId,
      password,
      profileImage: req.files['profileImage'] ? req.files['profileImage'][0].path : null,
      coverImage: req.files['coverImage'] ? req.files['coverImage'][0].path : null
    });

    await newAgency.save();
    res.status(201).json({ message: "Agency registered successfully", agency: newAgency });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
