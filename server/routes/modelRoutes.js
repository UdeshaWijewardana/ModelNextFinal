const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ModelUser = require('../models/ModelUser');
const { extractDateOfBirth } = require('../utils/dateExtractor');
const { verifyIdentityDocument } = require('../services/identityVerificationService');
const { livenessVerificationSessionService } = require('../services/livenessVerificationSessionService');
const { databaseUnavailable } = require('../middleware/requireDatabase');
const { USER_SESSION_COOKIE, cookieOptions, issueUserSession } = require('../utils/sessionCookies');

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
  if (['weight', 'height', 'waist', 'hip'].some((field) => !Number.isFinite(Number(data[field])) || Number(data[field]) <= 0)) {
    return 'Weight, height, waist, and hip must be numbers greater than 0.';
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

router.get('/', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const models = await ModelUser.find({ approvalStatus: 'approved' }).select('fullName categories height waist hip profileImage location').sort({ createdAt: -1 });
  return res.json({ models });
});

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
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not start liveness verification. Please try again.' });
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
  { name: 'idBack', maxCount: 1 }
]), async (req, res) => {
  const files = req.files || {};
  let livenessCredentials = null;
  let livenessClaimed = false;
  let registrationPersisted = false;
  try {
    if (mongoose.connection.readyState !== 1) {
      await removeUploadedFiles(files);
      return databaseUnavailable(res);
    }
    if (!process.env.JWT_SECRET) {
      await removeUploadedFiles(files);
      return res.status(503).json({ error: 'User authentication is not configured.' });
    }

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
    let parsedSkills = [];

        if (data.skills) {
          try {
            parsedSkills = JSON.parse(data.skills);
          } catch (e) {
            parsedSkills = data.skills
              .split(',')
              .map((skill) => skill.trim())
              .filter(Boolean);
          }
        }

    const registrationData = { ...data };
    for (const field of ['verification', 'verified', 'verificationStatus', 'verificationSummary', 'aiConfidence', 'aiChecks', 'approvalStatus', 'approvedAt', 'approvedBy', 'rejectionReason', 'livenessVerificationId', 'livenessAttemptId']) {
      delete registrationData[field];
    }

    const modelRecord = {
      ...registrationData,
      categories: parsedCategories,
      skills: parsedSkills,
      profileImage: files.profileImage ? files.profileImage[0].path : null,
      portfolioImages: files.portfolio ? files.portfolio.map((file) => file.path) : [],
      idFrontImage: idFront.path,
      idBackImage: files.idBack ? files.idBack[0].path : null,
      verificationStatus: 'identity_verified',
      verificationSummary: 'Identity document name and date of birth matched.',
      aiChecks: {
        ocrReadable: true,
        nameMatched: verificationResult.checks.nameMatch,
        dateOfBirthMatched: verificationResult.checks.dateOfBirthMatch
      },
      createdAt: new Date().toISOString()
    };

    modelRecord.email = modelRecord.email.trim().toLowerCase();
    modelRecord.password = await bcrypt.hash(modelRecord.password, 12);

    const newModel = new ModelUser(modelRecord);
    await newModel.save();
    registrationPersisted = true;
    res.cookie(USER_SESSION_COOKIE, issueUserSession(newModel, 'model'), cookieOptions());
    await sessionService.consume(livenessCredentials);
    livenessClaimed = false;
    return res.status(201).json({ message: 'Model registered successfully', model: { id: newModel._id, fullName: newModel.fullName, email: newModel.email, approvalStatus: newModel.approvalStatus } });
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
