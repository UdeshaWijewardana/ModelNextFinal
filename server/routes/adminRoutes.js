const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');
const Agency = require('../models/Agency');
const Client = require('../models/Client');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { requireAdmin } = require('../middleware/requireAdmin');
const { requireDatabase, databaseUnavailable } = require('../middleware/requireDatabase');
const { ADMIN_SESSION_COOKIE, cookieOptions, clearCookie } = require('../utils/sessionCookies');

const router = express.Router();
const PASSWORD_MIN_LENGTH = 12;

const safeAdmin = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
});

const issueToken = (admin) => jwt.sign(
  { role: admin.role },
  process.env.JWT_SECRET,
  { subject: admin._id.toString(), expiresIn: '8h' }
);

const registrationModels = {
  model: ModelUser,
  photographer: Photographer,
  agency: Agency,
  client: Client,
};

const safeRegistration = (role, registration) => ({
  id: registration._id,
  role,
  name: role === 'model' ? registration.fullName : (registration.name || registration.agencyName),
  email: registration.email,
  phone: registration.phone,
  location: registration.location || registration.address,
  approvalStatus: registration.approvalStatus,
  approvedAt: registration.approvedAt,
  rejectionReason: registration.rejectionReason,
  createdAt: registration.createdAt,
  identityVerificationStatus: role === 'model' ? registration.verificationStatus : undefined,
});

const getRegistrationModel = (role) => registrationModels[role] || null;
const serverRoot = path.join(__dirname, '..');

const publicUploadUrl = (storedPath) => {
  const normalized = typeof storedPath === 'string' ? storedPath.replace(/\\/g, '/') : '';
  if (!normalized.startsWith('uploads/') || normalized.includes('..')) return null;
  return `/uploads/${encodeURIComponent(path.posix.basename(normalized))}`;
};

const modelEvidence = (registration, kind) => ({
  'id-front': { storedPath: registration.idFrontImage, directory: 'uploads' },
  'id-back': { storedPath: registration.idBackImage, directory: 'uploads' },
  'liveness-front': { storedPath: registration.livenessEvidence?.frontImage, directory: 'verification-evidence' },
  'liveness-left': { storedPath: registration.livenessEvidence?.leftImage, directory: 'verification-evidence' },
  'liveness-right': { storedPath: registration.livenessEvidence?.rightImage, directory: 'verification-evidence' },
}[kind] || null);

const evidenceUrl = (registration, kind) => (
  modelEvidence(registration, kind)?.storedPath
    ? `/api/admin/registrations/model/${registration._id}/evidence/${kind}`
    : null
);

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Administrator registration is not configured.' });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existingAdmin = await Admin.exists({ email: normalizedEmail });
    if (existingAdmin) {
      return res.status(409).json({ error: 'An administrator account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ name: name.trim(), email: normalizedEmail, passwordHash });
    res.cookie(ADMIN_SESSION_COOKIE, issueToken(admin), cookieOptions());
    return res.status(201).json({
      message: 'Administrator account created.',
      admin: safeAdmin(admin),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An administrator account with this email already exists.' });
    }
    console.error('Administrator registration failed:', error.message);
    return res.status(500).json({ error: 'Unable to create administrator account.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Administrator authentication is not configured.' });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const admin = await Admin.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    res.cookie(ADMIN_SESSION_COOKIE, issueToken(admin), cookieOptions());
    return res.json({
      message: 'Administrator login successful.',
      admin: safeAdmin(admin),
    });
  } catch (error) {
    console.error('Administrator login failed:', error.message);
    return res.status(500).json({ error: 'Unable to sign in.' });
  }
});

router.get('/me', requireAdmin, (req, res) => {
  return res.json({ admin: safeAdmin(req.admin) });
});

router.post('/logout', (_req, res) => {
  clearCookie(res, ADMIN_SESSION_COOKIE);
  return res.status(204).end();
});

router.get('/registrations', requireAdmin, requireDatabase, async (req, res) => {
  try {
    const records = await Promise.all(Object.entries(registrationModels).map(async ([role, Model]) => {
      const registrations = await Model.find({})
        .select('-password -passwordHash -idFrontImage -idBackImage -selfieMedia -aiChecks')
        .sort({ createdAt: -1 });
      return registrations.map((registration) => safeRegistration(role, registration));
    }));
    return res.json({ registrations: records.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  } catch (error) {
    console.error('Registration review list failed:', error.message);
    return res.status(500).json({ error: 'Unable to load registration applications.' });
  }
});

router.get('/registrations/model/:id/identity-review', requireAdmin, requireDatabase, async (req, res) => {
  try {
    const registration = await ModelUser.findById(req.params.id);
    if (!registration) return res.status(404).json({ error: 'Model registration application was not found.' });

    return res.json({
      registration: safeRegistration('model', registration),
      identityReview: {
        document: {
          frontUrl: evidenceUrl(registration, 'id-front'),
          backUrl: evidenceUrl(registration, 'id-back'),
        },
        ocr: {
          status: registration.verificationStatus || 'Not provided',
          summary: registration.verificationSummary || 'Not provided',
          checks: registration.aiChecks ? {
            readable: Boolean(registration.aiChecks.ocrReadable),
            nameMatched: Boolean(registration.aiChecks.nameMatched),
            dateOfBirthMatched: Boolean(registration.aiChecks.dateOfBirthMatched),
          } : null,
        },
        registeredIdentity: {
          profileImageUrl: publicUploadUrl(registration.profileImage),
          portfolioImageUrls: (registration.portfolioImages || []).map(publicUploadUrl).filter(Boolean),
        },
        liveness: {
          status: registration.livenessVerificationStatus === 'completed' ? 'completed' : 'Not provided',
          frontUrl: evidenceUrl(registration, 'liveness-front'),
          leftUrl: evidenceUrl(registration, 'liveness-left'),
          rightUrl: evidenceUrl(registration, 'liveness-right'),
        },
      },
    });
  } catch (error) {
    return res.status(error.name === 'CastError' ? 400 : 500).json({
      error: error.name === 'CastError' ? 'Invalid registration application.' : 'Unable to load identity verification evidence.',
    });
  }
});

router.get('/registrations/model/:id/evidence/:kind', requireAdmin, requireDatabase, async (req, res) => {
  try {
    const registration = await ModelUser.findById(req.params.id).select('idFrontImage idBackImage livenessEvidence');
    if (!registration) return res.status(404).json({ error: 'Model registration application was not found.' });

    const evidence = modelEvidence(registration, req.params.kind);
    const normalized = evidence?.storedPath?.replace(/\\/g, '/');
    if (!normalized || !normalized.startsWith(`${evidence.directory}/`) || normalized.includes('..')) {
      return res.status(404).json({ error: 'Verification evidence was not provided.' });
    }

    const root = path.resolve(serverRoot, evidence.directory);
    const filePath = path.resolve(serverRoot, normalized);
    if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Verification evidence was not found.' });
    }
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(error.name === 'CastError' ? 400 : 500).json({
      error: error.name === 'CastError' ? 'Invalid registration application.' : 'Unable to load verification evidence.',
    });
  }
});

router.patch('/registrations/:role/:id/approve', requireAdmin, requireDatabase, async (req, res) => {
  const Model = getRegistrationModel(req.params.role);
  if (!Model) return res.status(400).json({ error: 'Unsupported registration role.' });

  try {
    const registration = await Model.findByIdAndUpdate(
      req.params.id,
      {
        $set: { approvalStatus: 'approved', approvedAt: new Date(), approvedBy: req.admin._id },
        $unset: { rejectionReason: 1 },
      },
      { new: true, runValidators: true }
    );
    if (!registration) return res.status(404).json({ error: 'Registration application was not found.' });
    return res.json({ registration: safeRegistration(req.params.role, registration) });
  } catch (error) {
    return res.status(error.name === 'CastError' ? 400 : 500).json({
      error: error.name === 'CastError' ? 'Invalid registration application.' : 'Unable to approve registration application.'
    });
  }
});

router.patch('/registrations/:role/:id/reject', requireAdmin, requireDatabase, async (req, res) => {
  const Model = getRegistrationModel(req.params.role);
  if (!Model) return res.status(400).json({ error: 'Unsupported registration role.' });

  const rejectionReason = typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
  try {
    const registration = await Model.findByIdAndUpdate(
      req.params.id,
      {
        $set: { approvalStatus: 'rejected', rejectionReason },
        $unset: { approvedAt: 1, approvedBy: 1 },
      },
      { new: true, runValidators: true }
    );
    if (!registration) return res.status(404).json({ error: 'Registration application was not found.' });
    return res.json({ registration: safeRegistration(req.params.role, registration) });
  } catch (error) {
    return res.status(error.name === 'CastError' ? 400 : 500).json({
      error: error.name === 'CastError' ? 'Invalid registration application.' : 'Unable to reject registration application.'
    });
  }
});

router.get('/events', requireAdmin, requireDatabase, async (_req, res) => {
  const events = await Event.find({}).sort({ createdAt: -1 });
  return res.json({ events });
});

router.patch('/events/:id/approve', requireAdmin, requireDatabase, async (req, res) => {
  const event = await Event.findByIdAndUpdate(req.params.id, {
    $set: { status: 'approved', approvedAt: new Date(), approvedBy: req.admin._id },
    $unset: { rejectionReason: 1 },
  }, { new: true, runValidators: true });
  if (!event) return res.status(404).json({ error: 'Event was not found.' });
  await Notification.create({ recipientId: event.ownerId, recipientRole: event.ownerRole, type: 'event_approved', message: `${event.title} was approved.` });
  return res.json({ event });
});

router.patch('/events/:id/reject', requireAdmin, requireDatabase, async (req, res) => {
  const rejectionReason = typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
  const event = await Event.findByIdAndUpdate(req.params.id, {
    $set: { status: 'rejected', rejectionReason },
    $unset: { approvedAt: 1, approvedBy: 1 },
  }, { new: true, runValidators: true });
  if (!event) return res.status(404).json({ error: 'Event was not found.' });
  await Notification.create({ recipientId: event.ownerId, recipientRole: event.ownerRole, type: 'event_rejected', message: `${event.title} was rejected.` });
  return res.json({ event });
});

module.exports = router;
