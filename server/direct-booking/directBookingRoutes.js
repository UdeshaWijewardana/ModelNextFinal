const express = require('express');
const mongoose = require('mongoose');
const DirectBooking = require('./models/DirectBooking');
const PrivateMessage = require('./models/PrivateMessage');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');
const Client = require('../models/Client');
const Agency = require('../models/Agency');
const EventRequest = require('../models/EventRequest');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');
const { findAccessibleBooking, completionEligibility } = require('./bookingAccess');

const router = express.Router();
router.use(requireUser, requireDatabase);
const requesterModels = { client: Client, agency: Agency, photographer: Photographer };
const talentModels = { model: ModelUser, photographer: Photographer };
const requesterName = (role, account) => role === 'agency' ? account.agencyName : account.name;
const talentName = (role, account) => role === 'model' ? account.fullName : account.name;
const dateKey = value => new Date(value).toISOString().slice(0, 10);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && dateKey(new Date(`${value}T00:00:00Z`)) === value;
const safe = booking => ({ id: booking._id, requesterId: booking.requesterId, requesterRole: booking.requesterRole, requesterName: booking.requesterName, talentId: booking.talentId, talentRole: booking.talentRole, talentName: booking.talentName, jobType: booking.jobType, bookingDate: booking.bookingDate, location: booking.location, description: booking.description, status: booking.status, createdAt: booking.createdAt, respondedAt: booking.respondedAt, completedAt: booking.completedAt });
const hasConfirmedEventConflict = async booking => {
  const requests = await EventRequest.find({ requesterId: booking.talentId, requesterRole: booking.talentRole, requestType: booking.talentRole === 'model' ? 'booking' : 'participation', status: 'confirmed' }).select('eventId').populate({ path: 'eventId', select: 'startDate endDate status', match: { status: 'approved' } }).lean();
  return requests.some(({ eventId }) => eventId?.startDate && booking.bookingDate >= dateKey(eventId.startDate) && booking.bookingDate <= dateKey(eventId.endDate || eventId.startDate));
};

router.post('/', async (req, res) => {
  const { talentId, talentRole, jobType, bookingDate, location, description } = req.body || {};
  const allowed = req.user.role === 'photographer' ? talentRole === 'model' : ['client', 'agency'].includes(req.user.role) && ['model', 'photographer'].includes(talentRole);
  if (!allowed) return res.status(403).json({ error: 'This account cannot book the selected talent type.' });
  if (!mongoose.isObjectIdOrHexString(talentId) || !validDate(bookingDate) || bookingDate < dateKey(new Date()) || !['Commercial Shoot', 'Fashion Editorial', 'Runway', 'Portfolio Shoot', 'Product Shoot', 'Other'].includes(jobType) || !String(location || '').trim() || !String(description || '').trim()) return res.status(400).json({ error: 'Complete all booking fields with a valid future date.' });
  if (String(talentId) === String(req.user.id) && talentRole === req.user.role) return res.status(400).json({ error: 'You cannot book yourself.' });
  const talent = await talentModels[talentRole].findOne({ _id: talentId, approvalStatus: 'approved' }).select(talentRole === 'model' ? 'fullName manualAvailability' : 'name manualAvailability');
  if (!talent) return res.status(404).json({ error: 'Approved talent was not found.' });
  const duplicate = await DirectBooking.exists({ requesterId: req.user.id, requesterRole: req.user.role, talentId, talentRole, bookingDate, status: 'pending' });
  if (duplicate) return res.status(409).json({ error: 'You already have a pending request for this talent on that date.' });
  const requester = await requesterModels[req.user.role].findById(req.user.id).select(req.user.role === 'agency' ? 'agencyName' : 'name');
  const booking = await DirectBooking.create({ requesterId: req.user.id, requesterRole: req.user.role, requesterName: requesterName(req.user.role, requester), talentId, talentRole, talentName: talentName(talentRole, talent), jobType, bookingDate, location: location.trim(), description: description.trim() });
  return res.status(201).json({ booking: safe(booking) });
});

router.get('/', async (req, res) => {
  const sent = await DirectBooking.find({ requesterId: req.user.id, requesterRole: req.user.role }).sort({ createdAt: -1 });
  const received = await DirectBooking.find({ talentId: req.user.id, talentRole: req.user.role }).sort({ createdAt: -1 });
  return res.json({ sent: sent.map(safe), received: received.map(safe) });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ error: 'Invalid booking ID.' });
  const booking = await findAccessibleBooking(req.params.id, req.user);
  if (!booking) return res.status(404).json({ error: 'Booking was not found.' });
  return res.json({ booking: safe(booking) });
});

router.patch('/:id/status', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !['confirmed', 'declined'].includes(req.body?.status)) return res.status(400).json({ error: 'A valid booking response is required.' });
  const booking = await DirectBooking.findOne({ _id: req.params.id, talentId: req.user.id, talentRole: req.user.role });
  if (!booking) return res.status(404).json({ error: 'Booking was not found.' });
  if (booking.status !== 'pending') return res.status(409).json({ error: 'This booking has already been answered.' });
  if (req.body.status === 'confirmed') {
    const talent = await talentModels[booking.talentRole].findById(booking.talentId).select('manualAvailability');
    if (talent?.manualAvailability?.some(entry => entry.date === booking.bookingDate && entry.status === 'unavailable')) return res.status(409).json({ error: 'This date is manually unavailable.' });
    const conflict = await DirectBooking.exists({ _id: { $ne: booking._id }, talentId: booking.talentId, talentRole: booking.talentRole, bookingDate: booking.bookingDate, status: 'confirmed' });
    if (conflict) return res.status(409).json({ error: 'This talent already has a confirmed direct booking on that date.' });
    if (await hasConfirmedEventConflict(booking)) return res.status(409).json({ error: 'This talent already has a confirmed event booking on that date.' });
  }
  booking.status = req.body.status; booking.respondedAt = new Date();
  try { await booking.save(); } catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'This talent already has a confirmed booking on that date.' }); throw error; }
  return res.json({ booking: safe(booking) });
});

router.patch('/:id/complete', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ error: 'Invalid booking ID.' });
  const existing = await DirectBooking.findById(req.params.id).select('requesterId requesterRole bookingDate status');
  if (!existing) return res.status(404).json({ error: 'Booking was not found.' });
  const eligibilityError = completionEligibility(existing, req.user, dateKey(new Date()));
  if (eligibilityError) return res.status(eligibilityError.status).json({ error: eligibilityError.error });

  const booking = await DirectBooking.findOneAndUpdate(
    { _id: existing._id, requesterId: req.user.id, requesterRole: req.user.role, status: 'confirmed', bookingDate: existing.bookingDate },
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true, runValidators: true }
  );
  if (!booking) return res.status(409).json({ error: 'This booking is no longer eligible for completion.' });
  return res.json({ booking: safe(booking) });
});

router.get('/:id/messages', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ error: 'Invalid booking ID.' });
  const booking = await findAccessibleBooking(req.params.id, req.user, true);
  if (!booking) return res.status(404).json({ error: 'Confirmed booking chat was not found.' });
  const messages = await PrivateMessage.find({ bookingId: booking._id }).sort({ createdAt: 1 }).limit(300);
  return res.json({ booking: safe(booking), messages: messages.map(message => ({ id: message._id, senderId: message.senderId, senderRole: message.senderRole, senderName: message.senderName, text: message.text, createdAt: message.createdAt })) });
});

router.post('/:id/messages', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !String(req.body?.text || '').trim() || String(req.body.text).trim().length > 2000) return res.status(400).json({ error: 'Message text is required and must be 2,000 characters or fewer.' });
  const booking = await findAccessibleBooking(req.params.id, req.user, true);
  if (!booking) return res.status(404).json({ error: 'Confirmed booking chat was not found.' });
  const name = booking.requesterRole === req.user.role && String(booking.requesterId) === String(req.user.id) ? booking.requesterName : booking.talentName;
  const saved = await PrivateMessage.create({ bookingId: booking._id, senderId: req.user.id, senderRole: req.user.role, senderName: name, text: req.body.text.trim() });
  const message = { id: saved._id, senderId: saved.senderId, senderRole: saved.senderRole, senderName: saved.senderName, text: saved.text, createdAt: saved.createdAt };
  req.app.get('directBookingRealtime')?.publish(String(booking._id), message);
  return res.status(201).json({ message });
});

module.exports = router;
