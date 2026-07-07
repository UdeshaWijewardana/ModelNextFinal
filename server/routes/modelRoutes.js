const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const ModelUser = require('../models/ModelUser');
const { runVerification } = require('../services/verificationService');

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

const buildAiVerification = (data, files) => {
  const requiredBack = data.idType !== 'passport';
  return {
    status: 'pending_ai_review',
    confidence: 0.91,
    summary: 'Document and liveness files were received and are queued for AI-assisted review.',
    checks: {
      documentUploaded: Boolean(files?.idFront?.length),
      bothSidesUploaded: requiredBack ? Boolean(files?.idBack?.length) : true,
      selfieSubmitted: Boolean(files?.selfieMedia?.length),
      livenessReady: Boolean(files?.selfieMedia?.length)
    }
  };
};

router.post('/register', upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'portfolio', maxCount: 6 },
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfieMedia', maxCount: 1 }
]), async (req, res) => {
  try {
    const data = req.body;
    const aiVerification = data.verification ? JSON.parse(data.verification) : buildAiVerification(data, req.files);

    if (!req.files?.idFront?.length) {
      return res.status(400).json({ error: 'The ID front image is required.' });
    }

    if (data.idType !== 'passport' && !req.files?.idBack?.length) {
      return res.status(400).json({ error: 'Both sides of the ID are required for national ID and driving license registrations.' });
    }

    if (!req.files?.selfieMedia?.length) {
      return res.status(400).json({ error: 'A selfie or selfie video is required for verification.' });
    }

    let parsedCategories = [];
    if (data.categories) {
      try {
        parsedCategories = JSON.parse(data.categories);
      } catch (e) {
        parsedCategories = data.categories.split(',');
      }
    }

    const verificationResult = await runVerification({
      fullName: data.fullName,
      birthdate: data.birthdate,
      idType: data.idType,
      idFrontPath: req.files?.idFront?.[0]?.path || null,
      idBackPath: req.files?.idBack?.[0]?.path || null,
      selfiePath: req.files?.selfieMedia?.[0]?.path || null
    });

    const modelRecord = {
      ...data,
      categories: parsedCategories,
      profileImage: req.files['profileImage'] ? req.files['profileImage'][0].path : null,
      portfolioImages: req.files['portfolio'] ? req.files['portfolio'].map((file) => file.path) : [],
      idFrontImage: req.files['idFront'] ? req.files['idFront'][0].path : null,
      idBackImage: req.files['idBack'] ? req.files['idBack'][0].path : null,
      selfieMedia: req.files['selfieMedia'] ? req.files['selfieMedia'][0].path : null,
      verificationStatus: verificationResult.status,
      verificationSummary: verificationResult.summary,
      aiConfidence: verificationResult.confidence,
      aiChecks: verificationResult.checks,
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
