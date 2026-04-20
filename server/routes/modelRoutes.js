const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ModelUser = require('../models/ModelUser');


// ================= UPLOAD CONFIG =================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });


// ================= REGISTER ROUTE =================
router.post(
  '/register',
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'portfolio', maxCount: 6 },
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 }
  ]),
  async (req, res) => {
    try {

      const data = req.body;

      // ✅ Validation
      if (!req.files['profileImage']) {
        return res.status(400).json({ error: "Profile image required" });
      }

      if (!req.files['portfolio'] || req.files['portfolio'].length !== 6) {
        return res.status(400).json({ error: "Upload exactly 6 portfolio images" });
      }

      if (!req.files['idFront']) {
        return res.status(400).json({ error: "ID Front image required" });
      }

      // ✅ Parse categories
      let parsedCategories = [];
      if (data.categories) {
        try {
          parsedCategories = JSON.parse(data.categories);
        } catch {
          parsedCategories = data.categories.split(',');
        }
      }

      // ✅ Save user
      const newModel = new ModelUser({
        ...data,
        categories: parsedCategories,

        profileImage: req.files['profileImage'][0].path,

        portfolioImages: req.files['portfolio'].map(f => f.path),

        idFront: req.files['idFront'][0].path,

        idBack: req.files['idBack']
          ? req.files['idBack'][0].path
          : null,

        verificationStatus: "pending"
      });

      await newModel.save();

      res.status(201).json({
        message: "Model registered successfully ✅",
        model: newModel
      });

    } catch (error) {
      console.error("SERVER ERROR:", error);

      if (error.code === 11000) {
        return res.status(400).json({ error: "Email already exists" });
      }

      res.status(500).json({
        error: "Server error during registration ❌"
      });
    }
  }
);

module.exports = router;