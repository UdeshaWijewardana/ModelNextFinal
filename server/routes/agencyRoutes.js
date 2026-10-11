const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('node:crypto');
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
    cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 2 }, fileFilter: (_req, file, callback) => callback(["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) ? null : new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname), ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) });
const removeUploads = req => Promise.all(Object.values(req.files || {}).flat().map(file => fs.promises.unlink(file.path).catch(() => undefined)));
const agencyUploads = (req, res, next) => upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }])(req, res, error => {
  if (!error) return next();
  removeUploads(req).finally(() => res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MiB or smaller.' : 'Agency images must be JPEG, PNG, or WebP files.' }));
});

router.get('/', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const agencies = await Agency.find({ approvalStatus: 'approved' }).select('agencyName ownerName address profileImage coverImage').sort({ createdAt: -1 });
  return res.json({ agencies });
});

router.post('/register', agencyUploads, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await removeUploads(req);
      return databaseUnavailable(res);
    }
    if (!process.env.JWT_SECRET) {
      await removeUploads(req);
      return res.status(503).json({ error: 'User authentication is not configured.' });
    }

    const { agencyName, ownerName, phone, email, address, businessId, password } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
    if (![agencyName, ownerName, address, password].every(value => typeof value === 'string' && value.trim()) || !normalizedEmail || !normalizedPhone || !req.files?.profileImage?.[0]) {
      await removeUploads(req); return res.status(400).json({ error: 'Complete every required agency field, including the agency logo.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !/^[+()\-\s0-9]{7,25}$/.test(normalizedPhone)) { await removeUploads(req); return res.status(400).json({ error: 'Enter a valid email address and contact number.' }); }
    if (password.length < 8) { await removeUploads(req); return res.status(400).json({ error: 'Password must be at least 8 characters.' }); }
    if (await Agency.exists({ email: normalizedEmail })) { await removeUploads(req); return res.status(409).json({ error: 'Email already exists.' }); }
    
    // In a real application, you should hash the password before saving!
    const newAgency = new Agency({
      agencyName: agencyName.trim(),
      ownerName: ownerName.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      address: address.trim(),
      businessId: businessId?.trim(),
      password: await bcrypt.hash(password, 12),
      profileImage: req.files['profileImage'] ? req.files['profileImage'][0].path : null,
      coverImage: req.files['coverImage'] ? req.files['coverImage'][0].path : null
    });

    await newAgency.save();
    res.cookie(USER_SESSION_COOKIE, issueUserSession(newAgency, 'agency'), cookieOptions());
    res.status(201).json({ message: "Agency registered successfully", agency: { id: newAgency._id, agencyName: newAgency.agencyName, email: newAgency.email } });
  } catch (error) {
    console.error(error);
    await removeUploads(req);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Email already exists." });
    }
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
