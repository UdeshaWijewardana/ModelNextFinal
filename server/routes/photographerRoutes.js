const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Photographer = require('../models/Photographer');
const EventRequest = require('../models/EventRequest');
const bcrypt = require('bcryptjs');
const { requireDatabase, databaseUnavailable } = require('../middleware/requireDatabase');
const { requireUser } = require('../middleware/requireUser');
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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return callback(null, true);
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "profileImage"));
  },
});
const removeUpload = (file) => file && fs.promises.unlink(file.path).catch(() => undefined);
const uploadProfileImage = (req, res, next) => upload.single('profileImage')(req, res, (error) => {
  if (!error) return next();
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? 'Profile image must be 5 MiB or smaller.'
    : 'Profile image must be a JPEG, PNG, or WebP file.';
  return res.status(400).json({ error: message });
});

router.get('/', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const photographers = await Photographer.find({ approvalStatus: 'approved' }).select('name location portfolio profileImage experienceYears').sort({ createdAt: -1 });
  return res.json({ photographers });
});

const monthBounds = (month) => {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(year, monthNumber - 1, 1)), end: new Date(Date.UTC(year, monthNumber, 1)) };
};
const dateKey = (value) => value.toISOString().slice(0, 10);
const isDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number); const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};
const bookedDatesForMonth = async (photographerId, bounds) => {
  const requests = await EventRequest.find({ requesterId: photographerId, requesterRole: 'photographer', requestType: 'participation', status: 'confirmed' })
    .select('eventId').populate({ path: 'eventId', select: 'startDate endDate status', match: { status: 'approved', startDate: { $lt: bounds.end }, $or: [{ endDate: { $gte: bounds.start } }, { endDate: null, startDate: { $gte: bounds.start } }] } }).lean();
  const dates = new Set();
  requests.forEach(({ eventId }) => {
    if (!eventId?.startDate) return;
    const start = new Date(eventId.startDate); const end = new Date(eventId.endDate || eventId.startDate);
    for (let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
      if (current >= bounds.start && current < bounds.end) dates.add(dateKey(current));
    }
  });
  return [...dates].sort();
};
const availabilityForMonth = async (photographer, bounds) => {
  const prefix = `${dateKey(bounds.start).slice(0, 7)}-`;
  const manualDates = (photographer.manualAvailability || []).filter((entry) => entry?.date?.startsWith(prefix) && isDateKey(entry.date) && ['available', 'unavailable'].includes(entry.status)).map((entry) => ({ date: entry.date, status: entry.status }));
  return { bookedDates: await bookedDatesForMonth(photographer._id, bounds), manualDates };
};
const photographerAvailabilityGuard = (req, res) => {
  if (req.user.role !== 'photographer') { res.status(403).json({ error: 'Only photographers can manage availability.' }); return false; }
  return true;
};

router.get('/me/availability', requireUser, requireDatabase, async (req, res) => {
  if (!photographerAvailabilityGuard(req, res)) return;
  const bounds = monthBounds(req.query.month); if (!bounds) return res.status(400).json({ error: 'A valid month is required.' });
  try {
    const photographer = await Photographer.findOne({ _id: req.user.id, approvalStatus: 'approved' }).select('manualAvailability');
    if (!photographer) return res.status(404).json({ error: 'Photographer account was not found.' });
    return res.json({ month: req.query.month, ...(await availabilityForMonth(photographer, bounds)) });
  } catch (error) { console.error('Photographer availability dashboard error:', error.message); return res.status(500).json({ error: 'Unable to load availability.' }); }
});

router.put('/me/availability/:date', requireUser, requireDatabase, async (req, res) => {
  if (!photographerAvailabilityGuard(req, res)) return;
  const { date } = req.params; const { status } = req.body || {}; const bounds = monthBounds(date?.slice(0, 7));
  if (!isDateKey(date) || !bounds || !['available', 'unavailable'].includes(status)) return res.status(400).json({ error: 'A valid future date and availability status are required.' });
  if (date < dateKey(new Date())) return res.status(400).json({ error: 'Past dates cannot be edited.' });
  try {
    const photographer = await Photographer.findOne({ _id: req.user.id, approvalStatus: 'approved' }).select('manualAvailability');
    if (!photographer) return res.status(404).json({ error: 'Photographer account was not found.' });
    if ((await bookedDatesForMonth(photographer._id, bounds)).includes(date)) return res.status(409).json({ error: 'Confirmed bookings cannot be overridden.' });
    const existing = photographer.manualAvailability.find((entry) => entry.date === date);
    if (existing) existing.status = status; else photographer.manualAvailability.push({ date, status });
    await photographer.save(); return res.json({ date, status });
  } catch (error) { console.error('Save photographer availability error:', error.message); return res.status(500).json({ error: 'Unable to save availability.' }); }
});

router.delete('/me/availability/:date', requireUser, requireDatabase, async (req, res) => {
  if (!photographerAvailabilityGuard(req, res)) return;
  const { date } = req.params; if (!isDateKey(date)) return res.status(400).json({ error: 'A valid date is required.' });
  if (date < dateKey(new Date())) return res.status(400).json({ error: 'Past dates cannot be edited.' });
  try {
    const photographer = await Photographer.findOne({ _id: req.user.id, approvalStatus: 'approved' }).select('manualAvailability');
    if (!photographer) return res.status(404).json({ error: 'Photographer account was not found.' });
    photographer.manualAvailability = photographer.manualAvailability.filter((entry) => entry.date !== date); await photographer.save(); return res.status(204).end();
  } catch (error) { console.error('Clear photographer availability error:', error.message); return res.status(500).json({ error: 'Unable to clear availability.' }); }
});

router.get('/:photographerId/availability', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const bounds = monthBounds(req.query.month);
  if (!bounds || !mongoose.Types.ObjectId.isValid(req.params.photographerId)) return res.status(400).json({ error: 'A valid photographer ID and month are required.' });
  try {
    const photographer = await Photographer.findOne({ _id: req.params.photographerId, approvalStatus: 'approved' }).select('manualAvailability');
    if (!photographer) return res.status(404).json({ error: 'Photographer profile was not found.' });
    const calendar = await availabilityForMonth(photographer, bounds);
    return res.json({ month: req.query.month, availabilityManaged: calendar.manualDates.length > 0, ...calendar });
  } catch (error) { console.error('Public photographer availability error:', error.message); return res.status(500).json({ error: 'Unable to load photographer availability.' }); }
});

router.get('/:photographerId', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  if (!mongoose.Types.ObjectId.isValid(req.params.photographerId)) return res.status(404).json({ error: 'Photographer profile was not found.' });
  try {
    const photographer = await Photographer.findOne({ _id: req.params.photographerId, approvalStatus: 'approved' }).select('name location portfolio profileImage experienceYears');
    if (!photographer) return res.status(404).json({ error: 'Photographer profile was not found.' });
    return res.json({ photographer });
  } catch (error) { console.error('Public photographer profile error:', error.message); return res.status(500).json({ error: 'Unable to load photographer profile.' }); }
});

router.post('/register', uploadProfileImage, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await removeUpload(req.file);
      return databaseUnavailable(res);
    }
    if (!process.env.JWT_SECRET) {
      await removeUpload(req.file);
      return res.status(503).json({ error: 'User authentication is not configured.' });
    }

    const { name, username, email, phone, location, portfolio, password, experienceYears } = req.body;
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
    const years = Number(experienceYears);
    if (!name?.trim() || !normalizedUsername || !normalizedEmail || !location?.trim() || !normalizedPhone || !password || !req.file) {
      await removeUpload(req.file);
      return res.status(400).json({ error: 'Complete all required photographer registration fields, including a profile image.' });
    }
    if (!/^[a-z0-9._-]{3,40}$/.test(normalizedUsername)) {
      await removeUpload(req.file);
      return res.status(400).json({ error: 'Username must use 3–40 letters, numbers, dots, hyphens, or underscores.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !/^[+()\-\s0-9]{7,25}$/.test(normalizedPhone) || !Number.isFinite(years) || years < 0) {
      await removeUpload(req.file);
      return res.status(400).json({ error: 'Enter a valid email, contact number, and non-negative experience in years.' });
    }
    if (password.length < 8) {
      await removeUpload(req.file);
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const newPhotographer = new Photographer({
      name: name.trim(), username: normalizedUsername, email: normalizedEmail, phone: normalizedPhone, location: location.trim(), portfolio: portfolio?.trim(), experienceYears: years,
      password: await bcrypt.hash(password, 12),
      profileImage: req.file ? req.file.path : null
    });

    await newPhotographer.save();
    res.cookie(USER_SESSION_COOKIE, issueUserSession(newPhotographer, 'photographer'), cookieOptions());
    res.status(201).json({ message: "Photographer registered successfully", photographer: { id: newPhotographer._id, name: newPhotographer.name, email: newPhotographer.email } });
  } catch (error) {
    console.error(error);
    await removeUpload(req.file);
    if (error.code === 11000) return res.status(409).json({ error: error.keyPattern?.username ? 'Username already exists.' : 'Email already exists.' });
    res.status(500).json({ error: "Unable to complete photographer registration." });
  }
});

module.exports = router;
