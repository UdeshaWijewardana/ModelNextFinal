const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const ModelUser = require('../models/ModelUser');
const { extractDateOfBirth } = require('../utils/dateExtractor');
const { verifyIdentityDocument } = require('../services/identityVerificationService');
const { livenessVerificationSessionService } = require('../services/livenessVerificationSessionService');

const allowedIdTypes = new Set(['nic', 'license', 'passport']);

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

const removeUploadedFiles = async (files) => {
  const uploadedFiles = Object.values(files || {}).flat();
  await Promise.all(uploadedFiles.map(async (file) => {
    try {
      await fs.promises.unlink(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Uploaded file cleanup failed:', error.message);
    }
  }));
};

const validateIdentityFields = (data) => {
  if (!data.fullName?.trim() || !data.birthdate || !data.idType) {
    return 'Full name, date of birth, and document type are required.';
  }
  if (!allowedIdTypes.has(data.idType)) {
    return 'Document type must be nic, license, or passport.';
  }
  if (!extractDateOfBirth(data.birthdate)) {
    return 'A valid date of birth is required.';
  }
  return null;
};

const validateRegistrationFields = (data, files) => {
  const requiredFields = ['email', 'password', 'location', 'phone', 'weight', 'height', 'waist', 'hip'];
  if (requiredFields.some((field) => !data[field]?.trim())) {
    return 'Email, password, location, phone, and all physical attributes are required.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return 'Enter a valid email address.';
  }
  if (!files.profileImage?.length) {
    return 'A profile image is required.';
  }
  if (files.portfolio?.length !== 6) {
    return 'All six portfolio images are required.';
  }
  return null;
};

const isUploadedImage = (file) => Boolean(
  file && file.size > 0 && file.mimetype?.startsWith('image/')
);

const verificationUpload = upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 }
]);

const getLivenessSessionService = (req) => (
  req.app.locals.livenessVerificationSessionService || livenessVerificationSessionService
);

const getIdentityVerifier = (req) => (
  req.app.locals.verifyIdentityDocument || verifyIdentityDocument
);

const handleVerificationUpload = (req, res, next) => {
  verificationUpload(req, res, (error) => {
    if (error) {
      return res.status(400).json({ success: false, error: 'Invalid identity document upload.' });
    }
    next();
  });
};

router.post('/verify-identity', handleVerificationUpload, async (req, res) => {
  const files = req.files || {};
  try {
    const validationError = validateIdentityFields(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const idFront = files.idFront?.[0];
    if (!idFront) {
      return res.status(400).json({ success: false, error: 'The ID front image is required.' });
    }
    if (!isUploadedImage(idFront)) {
      return res.status(400).json({ success: false, error: 'Upload a non-empty image for the ID front.' });
    }

    const result = await getIdentityVerifier(req)({
      filePath: idFront.path,
      fullName: req.body.fullName,
      birthdate: req.body.birthdate
    });

    return res.status(200).json({
      success: true,
      ...result,
      message: result.verified
        ? 'Identity document name and date of birth match.'
        : 'Name and date of birth could not both be verified from this document.'
    });
  } catch (error) {
    if (error.code === 'OCR_UNREADABLE_IMAGE') {
      console.warn('Identity OCR rejected an unreadable document:', error.message);
    } else {
      console.error('Identity OCR verification failed:', error.cause || error);
    }
    return res.status(error.code === 'OCR_UNREADABLE_IMAGE' ? 400 : 500).json({
      success: false,
      verified: false,
      error: error.code === 'OCR_UNREADABLE_IMAGE'
        ? 'OCR could not process this document. Please try a clearer image.'
        : 'Identity verification failed because of a server error.'
    });
  } finally {
    await removeUploadedFiles(files);
  }
});

router.post('/liveness/start', async (req, res) => {
  try {
    const session = await getLivenessSessionService(req).start();
    return res.status(201).json(session);
  } catch (error) {
    console.error('Liveness session creation failed:', error.message);
    return res.status(500).json({ error: 'Could not start liveness verification. Please try again.' });
  }
});

router.post('/liveness/complete', async (req, res) => {
  try {
    await getLivenessSessionService(req).complete({
      verificationId: req.body?.verificationId,
      attemptId: req.body?.attemptId,
    });
    return res.status(200).json({ completed: true });
  } catch (error) {
    return res.status(error.status || 500).json({
      ...(error.status ? { code: error.code } : {}),
      error: error.status ? error.message : 'Could not confirm liveness verification. Please try again.',
    });
  }
});

router.post('/register', upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'portfolio', maxCount: 6 },
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfieMedia', maxCount: 1 }
]), async (req, res) => {
  const files = req.files || {};
  let livenessCredentials = null;
  let livenessClaimed = false;
  let registrationPersisted = false;
  try {
    const data = req.body;
    const validationError = validateIdentityFields(data);
    if (validationError) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, error: validationError });
    }
    const registrationFieldsError = validateRegistrationFields(data, files);
    if (registrationFieldsError) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, error: registrationFieldsError });
    }

    const idFront = files.idFront?.[0];
    if (!idFront) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, error: 'The ID front image is required.' });
    }
    if (!isUploadedImage(idFront)) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, error: 'Upload a non-empty image for the ID front.' });
    }
    if (data.idType !== 'passport' && !files.idBack?.length) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, error: 'Both sides of the ID are required for national ID and driving license registrations.' });
    }
    if (!files.selfieMedia?.length) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, error: 'A selfie or selfie video is still required by the existing registration form.' });
    }

    livenessCredentials = {
      verificationId: data.livenessVerificationId,
      attemptId: data.livenessAttemptId,
    };
    const sessionService = getLivenessSessionService(req);
    await sessionService.assertCompleted(livenessCredentials);

    // Registration always reruns OCR on the uploaded document; client verification flags are not trusted.
    const verificationResult = await getIdentityVerifier(req)({
      filePath: idFront.path,
      fullName: data.fullName,
      birthdate: data.birthdate
    });

    if (!verificationResult.verified) {
      await removeUploadedFiles(files);
      return res.status(400).json({
        success: false,
        verified: false,
        checks: verificationResult.checks,
        extracted: verificationResult.extracted,
        error: 'Identity document name and date of birth must both match before registration.'
      });
    }

    await sessionService.claim(livenessCredentials);
    livenessClaimed = true;

    let parsedCategories = [];
    if (data.categories) {
      try {
        parsedCategories = JSON.parse(data.categories);
      } catch (e) {
        parsedCategories = data.categories.split(',');
      }
    }

    const registrationData = { ...data };
    for (const field of ['verification', 'verified', 'verificationStatus', 'verificationSummary', 'aiConfidence', 'aiChecks', 'livenessVerificationId', 'livenessAttemptId']) {
      delete registrationData[field];
    }

    const modelRecord = {
      ...registrationData,
      categories: parsedCategories,
      profileImage: files.profileImage ? files.profileImage[0].path : null,
      portfolioImages: files.portfolio ? files.portfolio.map((file) => file.path) : [],
      idFrontImage: idFront.path,
      idBackImage: files.idBack ? files.idBack[0].path : null,
      selfieMedia: files.selfieMedia ? files.selfieMedia[0].path : null,
      verificationStatus: 'identity_verified',
      verificationSummary: 'Identity document name and date of birth matched.',
      aiChecks: {
        ocrReadable: true,
        nameMatched: verificationResult.checks.nameMatch,
        dateOfBirthMatched: verificationResult.checks.dateOfBirthMatch
      },
      createdAt: new Date().toISOString()
    };

    if (mongoose.connection.readyState === 1) {
      const newModel = new ModelUser(modelRecord);
      await newModel.save();
      registrationPersisted = true;
      await sessionService.consume(livenessCredentials);
      livenessClaimed = false;
      return res.status(201).json({ message: 'Model registered successfully', model: newModel });
    }

    const existingModels = req.app.locals.readLocalModels();
    existingModels.push(modelRecord);
    req.app.locals.writeLocalModels(existingModels);
    registrationPersisted = true;
    await sessionService.consume(livenessCredentials);
    livenessClaimed = false;
    res.status(201).json({ message: 'Model registered successfully using local fallback storage', model: modelRecord });
  } catch (error) {
    if (!registrationPersisted) await removeUploadedFiles(files);
    if (livenessClaimed && !registrationPersisted && livenessCredentials) {
      try {
        await getLivenessSessionService(req).release(livenessCredentials);
      } catch (releaseError) {
        console.error('Liveness session release failed:', releaseError.message);
      }
    }
    if (error.code === 'OCR_UNREADABLE_IMAGE') {
      console.warn('Model registration rejected an unreadable identity document:', error.message);
    } else if (!error.status) {
      console.error(error);
    }
    if (error.code === 11000) return res.status(400).json({ error: 'Email already exists' });
    res.status(error.status || (error.code === 'OCR_UNREADABLE_IMAGE' ? 400 : 500)).json({
      success: false,
      verified: false,
      ...(error.status ? { code: error.code } : {}),
      error: error.status
        ? error.message
        : error.code === 'OCR_UNREADABLE_IMAGE'
        ? 'OCR could not process this document. Registration was not saved.'
        : 'Server error during registration.'
    });
  }
});

module.exports = router;
