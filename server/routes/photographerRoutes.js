const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Photographer = require('../models/Photographer');
const bcrypt = require('bcryptjs');
const { databaseUnavailable } = require('../middleware/requireDatabase');
const { USER_SESSION_COOKIE, cookieOptions, issueUserSession } = require('../utils/sessionCookies');

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

router.get('/', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const photographers = await Photographer.find({ approvalStatus: 'approved' }).select('name location portfolio profileImage').sort({ createdAt: -1 });
  return res.json({ photographers });
});

router.post('/register', upload.single('profileImage'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => undefined);
      return databaseUnavailable(res);
    }
    if (!process.env.JWT_SECRET) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => undefined);
      return res.status(503).json({ error: 'User authentication is not configured.' });
    }

    const { name, email, phone, location, portfolio, password } = req.body;
    const newPhotographer = new Photographer({
      name, email: email?.trim().toLowerCase(), phone, location, portfolio,
      password: await bcrypt.hash(password, 12),
      profileImage: req.file ? req.file.path : null
    });

    await newPhotographer.save();
    res.cookie(USER_SESSION_COOKIE, issueUserSession(newPhotographer, 'photographer'), cookieOptions());
    res.status(201).json({ message: "Photographer registered successfully", photographer: { id: newPhotographer._id, name: newPhotographer.name, email: newPhotographer.email } });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
