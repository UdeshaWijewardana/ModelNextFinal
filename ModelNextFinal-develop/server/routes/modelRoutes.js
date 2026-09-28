const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const ModelUser = require('../models/ModelUser');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir); }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/register', upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'portfolio', maxCount: 6 }
]), async (req, res) => {
  try {
    const data = req.body;

    let parsedCategories = [];
    if (data.categories) {
      try {
        parsedCategories = JSON.parse(data.categories);
      } catch (e) {
        parsedCategories = data.categories.split(',');
      }
    }

    const modelRecord = {
      ...data,
      categories: parsedCategories,
      profileImage: req.files['profileImage'] ? req.files['profileImage'][0].path : null,
      portfolioImages: req.files['portfolio'] ? req.files['portfolio'].map((file) => file.path) : [],
      createdAt: new Date().toISOString()
    };

    if (mongoose.connection.readyState === 1) {
      const newModel = new ModelUser(modelRecord);
      await newModel.save();
      return res.status(201).json({ message: 'Model registered successfully', model: newModel });
    }

    const existingModels = req.app.locals.readLocalModels();
    existingModels.push(modelRecord);
    req.app.locals.writeLocalModels(existingModels);
    res.status(201).json({ message: 'Model registered successfully using local fallback storage', model: modelRecord });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error during registration' });
  }
});

module.exports = router;
