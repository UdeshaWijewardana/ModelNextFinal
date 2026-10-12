const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ModelUser = require('../models/ModelUser');
const EventRequest = require('../models/EventRequest');
const { directBookedDatesForMonth } = require('../direct-booking/availability');
const { extractDateOfBirth } = require('../ocr/dateExtractor');
const { isValidDocumentNumber } = require('../ocr/documentNumberExtractor');
const { verifyIdentityDocument } = require('../ocr/identityVerificationService');
const { livenessVerificationSessionService } = require('../liveness-check/livenessVerificationSessionService');
const { requireDatabase, databaseUnavailable } = require('../middleware/requireDatabase');
const { requireUser } = require('../middleware/requireUser');
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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype?.startsWith('image/') === true),
});

const evidenceDirectory = path.join(__dirname, '..', 'verification-evidence');
const evidenceMimeTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const evidenceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(evidenceDirectory, { recursive: true });
      cb(null, evidenceDirectory);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${evidenceMimeTypes.get(file.mimetype) || ''}`),
});
const evidenceUpload = multer({
  storage: evidenceStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, evidenceMimeTypes.has(file.mimetype)),
});

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

const removeUploadedFile = async (file) => {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Verification evidence cleanup failed:', error.message);
  }
};

const fileDigest = async (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('error', reject);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const validateIdentityFields = (data) => {
  if (!data.fullName?.trim() || !data.birthdate || !data.idType || !data.identityDocumentNumber?.trim()) {
    return 'Full name, date of birth, document type, and document number are required.';
  }
  if (!allowedIdTypes.has(data.idType)) {
    return 'Document type must be nic, license, or passport.';
  }
  if (!extractDateOfBirth(data.birthdate)) {
    return 'A valid date of birth is required.';
  }
  if (!isValidDocumentNumber(data.idType, data.identityDocumentNumber)) {
    return 'Enter a valid document number for the selected document type.';
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

const monthBounds = (month) => {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;

  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1)),
  };
};

const dateKey = (value) => value.toISOString().slice(0, 10);
const isDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const dateKeysInRange = (startValue, endValue, bounds) => {
  const start = new Date(Date.UTC(
    startValue.getUTCFullYear(),
    startValue.getUTCMonth(),
    startValue.getUTCDate()
  ));
  const end = new Date(Date.UTC(
    endValue.getUTCFullYear(),
    endValue.getUTCMonth(),
    endValue.getUTCDate()
  ));
  const dates = [];

  for (let current = start; current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    if (current >= bounds.start && current < bounds.end) dates.push(dateKey(current));
  }

  return dates;
};

const bookedDatesForMonth = async (modelId, bounds) => {
  const requests = await EventRequest.find({
    requesterId: modelId,
    requesterRole: 'model',
    requestType: 'booking',
    status: 'confirmed',
  })
    .select('eventId')
    .populate({
      path: 'eventId',
      select: 'startDate endDate status',
      match: {
        status: 'approved',
        startDate: { $lt: bounds.end },
        $or: [
          { endDate: { $gte: bounds.start } },
          { endDate: null, startDate: { $gte: bounds.start } },
        ],
      },
    })
    .lean();

  const bookedDates = new Set();

  requests.forEach(({ eventId }) => {
    if (!eventId || eventId.status !== 'approved' || !eventId.startDate) return;

    const eventStart = new Date(eventId.startDate);
    const eventEnd = new Date(eventId.endDate || eventId.startDate);
    if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) return;

    dateKeysInRange(eventStart, eventEnd, bounds).forEach((date) => bookedDates.add(date));
  });

  (await directBookedDatesForMonth(modelId, 'model', bounds)).forEach((date) => bookedDates.add(date));
  return [...bookedDates].sort();
};

const availabilityForMonth = async (model, bounds) => {
  const bookedDates = await bookedDatesForMonth(model._id, bounds);
  const prefix = `${dateKey(bounds.start).slice(0, 7)}-`;
  const manualDates = (model.manualAvailability || [])
    .filter((entry) => entry?.date?.startsWith(prefix))
    .map((entry) => ({ date: entry.date, status: entry.status }))
    .filter((entry) => isDateKey(entry.date) && ['available', 'unavailable'].includes(entry.status));

  return { bookedDates, manualDates };
};

const modelAvailabilityGuard = (req, res) => {
  if (req.user.role !== 'model') {
    res.status(403).json({ error: 'Only models can manage availability.' });
    return false;
  }
  return true;
};

router.get('/me/availability', requireUser, requireDatabase, async (req, res) => {
  if (!modelAvailabilityGuard(req, res)) return;

  const bounds = monthBounds(req.query.month);
  if (!bounds) return res.status(400).json({ error: 'A valid month is required.' });

  try {
    const model = await ModelUser.findOne({ _id: req.user.id, approvalStatus: 'approved' })
      .select('manualAvailability');
    if (!model) return res.status(404).json({ error: 'Model account was not found.' });

    return res.json({
      month: req.query.month,
      ...(await availabilityForMonth(model, bounds)),
    });
  } catch (error) {
    console.error('Model availability dashboard error:', error.message);
    return res.status(500).json({ error: 'Unable to load availability.' });
  }
});

router.put('/me/availability/:date', requireUser, requireDatabase, async (req, res) => {
  if (!modelAvailabilityGuard(req, res)) return;

  const { date } = req.params;
  const { status } = req.body || {};
  const bounds = monthBounds(date?.slice(0, 7));

  if (!isDateKey(date) || !bounds || !['available', 'unavailable'].includes(status)) {
    return res.status(400).json({ error: 'A valid future date and availability status are required.' });
  }
  if (date < dateKey(new Date())) {
    return res.status(400).json({ error: 'Past dates cannot be edited.' });
  }

  try {
    const model = await ModelUser.findOne({ _id: req.user.id, approvalStatus: 'approved' })
      .select('manualAvailability');
    if (!model) return res.status(404).json({ error: 'Model account was not found.' });

    const bookedDates = await bookedDatesForMonth(model._id, bounds);
    if (bookedDates.includes(date)) {
      return res.status(409).json({ error: 'Confirmed bookings cannot be overridden.' });
    }

    const existing = model.manualAvailability.find((entry) => entry.date === date);
    if (existing) existing.status = status;
    else model.manualAvailability.push({ date, status });
    await model.save();

    return res.json({ date, status });
  } catch (error) {
    console.error('Save model availability error:', error.message);
    return res.status(500).json({ error: 'Unable to save availability.' });
  }
});

router.delete('/me/availability/:date', requireUser, requireDatabase, async (req, res) => {
  if (!modelAvailabilityGuard(req, res)) return;

  const { date } = req.params;
  if (!isDateKey(date)) return res.status(400).json({ error: 'A valid date is required.' });
  if (date < dateKey(new Date())) return res.status(400).json({ error: 'Past dates cannot be edited.' });

  try {
    const model = await ModelUser.findOne({ _id: req.user.id, approvalStatus: 'approved' })
      .select('manualAvailability');
    if (!model) return res.status(404).json({ error: 'Model account was not found.' });

    model.manualAvailability = model.manualAvailability.filter((entry) => entry.date !== date);
    await model.save();
    return res.status(204).end();
  } catch (error) {
    console.error('Clear model availability error:', error.message);
    return res.status(500).json({ error: 'Unable to clear availability.' });
  }
});

// This is intentionally read-only and returns no event title, client, or
// request information.
router.get('/:modelId/availability', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  const bounds = monthBounds(req.query.month);
  if (!bounds || !mongoose.Types.ObjectId.isValid(req.params.modelId)) {
    return res.status(400).json({ error: 'A valid model ID and month are required.' });
  }

  try {
    const model = await ModelUser.findOne({
      _id: req.params.modelId,
      approvalStatus: 'approved',
    }).select('manualAvailability');

    if (!model) {
      return res.status(404).json({ error: 'Model profile was not found.' });
    }

    const calendar = await availabilityForMonth(model, bounds);

    return res.json({
      month: req.query.month,
      availabilityManaged: calendar.manualDates.length > 0,
      ...calendar,
    });
  } catch (error) {
    console.error('Public model availability error:', error.message);
    return res.status(500).json({ error: 'Unable to load model availability.' });
  }
});

// Public profile data is deliberately limited to approved models and fields
// that are appropriate for the fashion directory. Keep contact, identity,
// verification, approval, and session-related fields private.
router.get('/:modelId', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  if (!mongoose.Types.ObjectId.isValid(req.params.modelId)) {
    return res.status(404).json({ error: 'Model profile was not found.' });
  }

  try {
    const model = await ModelUser.findOne({
      _id: req.params.modelId,
      approvalStatus: 'approved',
    }).select(
      'fullName categories skills location gender profileImage portfolioImages weight height waist hip'
    );

    if (!model) {
      return res.status(404).json({ error: 'Model profile was not found.' });
    }

    return res.json({ model });
  } catch (error) {
    console.error('Public model profile error:', error.message);
    return res.status(500).json({ error: 'Unable to load the model profile.' });
  }
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
    const idBack = files.idBack?.[0];
    if (req.body.idType !== 'passport' && !isUploadedImage(idBack)) {
      return res.status(400).json({ success: false, error: 'Upload non-empty front and back images for this document.' });
    }

    const result = await getIdentityVerifier(req)({
      filePaths: [idFront, idBack].filter(Boolean).map(file => file.path),
      fullName: req.body.fullName,
      birthdate: req.body.birthdate,
      idType: req.body.idType,
      identityDocumentNumber: req.body.identityDocumentNumber
    });

    return res.status(200).json({
      success: true,
      verified: result.verified,
      prototypePassed: result.prototypePassed,
      overallStatus: result.overallStatus,
      checks: result.checks,
      message: result.prototypePassed
        ? 'Document Verification: Passed (Prototype)'
        : 'Document Verification: Failed'
    });
  } catch (error) {
    const clientError = ['IDENTITY_IMAGE_INVALID', 'OCR_INVALID_REQUEST'].includes(error.code);
    console.warn(clientError ? 'Identity verification rejected an invalid document.' : 'Identity extraction service unavailable.');
    return res.status(clientError ? 400 : 503).json({
      success: false,
      verified: false,
      prototypePassed: false,
      overallStatus: 'unable_to_verify',
      error: clientError
        ? 'The document image could not be processed. Please upload a valid, clear image.'
        : 'Identity verification is temporarily unavailable. Please try again later.'
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

router.post('/liveness/evidence', (req, res, next) => {
  evidenceUpload.single('capture')(req, res, (error) => {
    if (error) return res.status(400).json({ error: 'Upload one valid liveness image no larger than 5 MB.' });
    next();
  });
}, async (req, res) => {
  let keepFile = false;
  try {
    const captureType = req.body?.captureType;
    if (!['front', 'left', 'right'].includes(captureType) || !isUploadedImage(req.file)) {
      return res.status(400).json({ error: 'A valid FRONT, LEFT, or RIGHT liveness image is required.' });
    }

    const credentials = {
      verificationId: req.body?.verificationId,
      attemptId: req.body?.attemptId,
    };
    const result = await getLivenessSessionService(req).recordEvidence(credentials, captureType, {
      path: path.posix.join('verification-evidence', req.file.filename),
      digest: await fileDigest(req.file.path),
    });
    keepFile = !result.reused;
    return res.status(201).json({ captured: true, captureType, reused: result.reused });
  } catch (error) {
    return res.status(error.status || 500).json({
      ...(error.status ? { code: error.code } : {}),
      error: error.status ? error.message : 'Could not store liveness verification evidence.',
    });
  } finally {
    if (!keepFile) await removeUploadedFile(req.file);
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
    const idBack = files.idBack?.[0];
    if (data.idType !== 'passport' && !isUploadedImage(idBack)) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, error: 'Both sides of the ID are required for national ID and driving license registrations.' });
    }
    livenessCredentials = {
      verificationId: data.livenessVerificationId,
      attemptId: data.livenessAttemptId,
    };
    const sessionService = getLivenessSessionService(req);
    await sessionService.assertCompleted(livenessCredentials);
    const livenessEvidence = await sessionService.getCompletedEvidence(livenessCredentials);

    // Registration always reruns OCR on the uploaded document; client verification flags are not trusted.
    const verificationResult = await getIdentityVerifier(req)({
      filePaths: [idFront, idBack].filter(Boolean).map(file => file.path),
      fullName: data.fullName,
      birthdate: data.birthdate,
      idType: data.idType,
      identityDocumentNumber: data.identityDocumentNumber
    });

    if (!verificationResult.prototypePassed) {
      await removeUploadedFiles(files);
      return res.status(400).json({
        success: false,
        verified: false,
        prototypePassed: false,
        checks: verificationResult.checks,
        overallStatus: verificationResult.overallStatus,
        error: 'Document Verification: Failed'
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
      } catch (_error) {
        parsedSkills = data.skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean);
      }
    }

    const registrationData = { ...data };
    delete registrationData.identityDocumentNumber;
    for (const field of ['verification', 'verified', 'verificationStatus', 'nameVerificationStatus', 'verificationSummary', 'aiConfidence', 'aiChecks', 'approvalStatus', 'approvedAt', 'approvedBy', 'rejectionReason', 'livenessVerificationId', 'livenessAttemptId']) {
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
      verificationStatus: 'prototype_passed',
      nameVerificationStatus: 'pending',
      verificationSummary: 'Document Verification: Passed (Prototype). Name verification is pending.',
      aiChecks: {
        ocrReadable: Boolean(
          verificationResult.checks.dateOfBirthMatch
          && verificationResult.checks.documentNumberMatch
        ),
        nameOcrStatus: verificationResult.checks.name?.status || 'unable_to_read',
        dateOfBirthMatched: verificationResult.checks.dateOfBirthMatch,
        documentNumberMatched: verificationResult.checks.documentNumberMatch,
        submittedIdentity: {
          fullName: data.fullName,
          dateOfBirth: data.birthdate,
          documentType: data.idType,
          documentNumber: data.identityDocumentNumber,
        },
        extractedIdentity: verificationResult.extractedIdentity,
        identityChecks: verificationResult.checks,
        livenessEvidenceCapturedAt: {
          front: livenessEvidence.front.capturedAt || null,
          left: livenessEvidence.left.capturedAt || null,
          right: livenessEvidence.right.capturedAt || null,
        },
      },
      livenessVerificationStatus: 'completed',
      livenessEvidence: {
        frontImage: livenessEvidence.front.path,
        leftImage: livenessEvidence.left.path,
        rightImage: livenessEvidence.right.path,
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
    const identityError = typeof error.code === 'string'
      && (error.code.startsWith('OCR_') || error.code.startsWith('OPENAI_') || error.code === 'IDENTITY_IMAGE_INVALID');
    if (identityError) console.warn('Model registration identity extraction was unavailable or invalid.');
    else if (!error.status) console.error('Model registration failed.');
    if (error.code === 11000) return res.status(400).json({ error: 'Email already exists' });
    const identityStatus = ['IDENTITY_IMAGE_INVALID', 'OCR_INVALID_REQUEST'].includes(error.code) ? 400 : 503;
    res.status(error.status || (identityError ? identityStatus : 500)).json({
      success: false,
      verified: false,
      ...(error.status ? { code: error.code } : {}),
      error: error.status
        ? error.message
        : identityError
        ? 'Identity verification could not be completed. Registration was not saved.'
        : 'Server error during registration.'
    });
  }
});

module.exports = router;
