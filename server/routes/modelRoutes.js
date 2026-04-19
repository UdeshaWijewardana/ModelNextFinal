const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ModelUser = require('../models/ModelUser');

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

router.post('/register', upload.fields([
  { name: 'profileImage', maxCount: 1 }, 
  { name: 'portfolio', maxCount: 6 }
]), async (req, res) => {
  try {
    const data = req.body;
    let parsedCategories = [];
    if (data.categories) {
       try { parsedCategories = JSON.parse(data.categories); }
       catch (e) { parsedCategories = data.categories.split(','); }
    }
    const newModel = new ModelUser({
      ...data,
      categories: parsedCategories,
      profileImage: req.files['profileImage'] ? req.files['profileImage'][0].path : null,
      portfolioImages: req.files['portfolio'] ? req.files['portfolio'].map(f => f.path) : []
    });

    await newModel.save();
    res.status(201).json({ message: "Model registered successfully", model: newModel });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
