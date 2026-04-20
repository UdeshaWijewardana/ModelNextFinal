const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Photographer = require('../models/Photographer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)){ fs.mkdirSync(dir); }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.post('/register', upload.single('profileImage'), async (req, res) => {
  try {
    const newPhotographer = new Photographer({
      ...req.body,
      profileImage: req.file ? req.file.path : null
    });

    await newPhotographer.save();
    res.status(201).json({ message: "Photographer registered successfully", photographer: newPhotographer });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
