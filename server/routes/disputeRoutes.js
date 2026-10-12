const express = require('express');
const mongoose = require('mongoose');
const Dispute = require('../models/Dispute');
const DirectBooking = require('../direct-booking/models/DirectBooking');
const { isParty } = require('../direct-booking/bookingAccess');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');

const router = express.Router();
const reasons = new Set(['No-show', 'Unprofessional behavior', 'Payment issue', 'Service quality', 'Harassment', 'Other']);
router.use(requireUser, requireDatabase);

const isComplainant = (dispute, user) => String(dispute.complainantId) === String(user.id) && dispute.complainantRole === user.role;
const isRespondent = (dispute, user) => String(dispute.respondentId) === String(user.id) && dispute.respondentRole === user.role;
const safeDispute = (dispute, user) => ({
  id: dispute._id,
  bookingId: dispute.bookingId,
  reason: dispute.reason,
  description: dispute.description,
  status: dispute.status,
  adminResolution: dispute.status === 'resolved' ? dispute.adminResolution : undefined,
  resolvedAt: dispute.resolvedAt,
  createdAt: dispute.createdAt,
  updatedAt: dispute.updatedAt,
  isComplainant: isComplainant(dispute, user),
});

const disputeInput = body => ({ reason: body?.reason, description: typeof body?.description === 'string' ? body.description.trim() : '' });
const invalidInput = input => !reasons.has(input.reason) || input.description.length < 10 || input.description.length > 1000;
const disputeParties = (booking, user) => {
  const requesterIsComplainant = String(booking.requesterId) === String(user.id) && booking.requesterRole === user.role;
  return { respondentId: requesterIsComplainant ? booking.talentId : booking.requesterId, respondentRole: requesterIsComplainant ? booking.talentRole : booking.requesterRole };
};

router.post('/', async (req, res) => {
  const input = disputeInput(req.body);
  if (!mongoose.isObjectIdOrHexString(req.body?.bookingId)) return res.status(400).json({ error: 'A valid booking ID is required.' });
  if (invalidInput(input)) return res.status(400).json({ error: 'Choose a valid reason and enter a description between 10 and 1,000 characters.' });
  const booking = await DirectBooking.findById(req.body.bookingId);
  if (!booking || !isParty(booking, req.user)) return res.status(404).json({ error: 'Eligible booking was not found.' });
  if (!['confirmed', 'completed'].includes(booking.status)) return res.status(409).json({ error: 'Issues can only be reported for confirmed or completed bookings.' });
  const { respondentId, respondentRole } = disputeParties(booking, req.user);
  try {
    const dispute = await Dispute.create({ bookingId: booking._id, complainantId: req.user.id, complainantRole: req.user.role, respondentId, respondentRole, ...input });
    return res.status(201).json({ dispute: safeDispute(dispute, req.user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'You already have an active dispute for this booking.' });
    throw error;
  }
});

router.get('/', async (req, res) => {
  const party = { $or: [{ complainantId: req.user.id, complainantRole: req.user.role }, { respondentId: req.user.id, respondentRole: req.user.role }] };
  const disputes = await Dispute.find(party).sort({ createdAt: -1 });
  return res.json({ disputes: disputes.map(dispute => safeDispute(dispute, req.user)) });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ error: 'Invalid dispute ID.' });
  const dispute = await Dispute.findById(req.params.id);
  if (!dispute || (!isComplainant(dispute, req.user) && !isRespondent(dispute, req.user))) return res.status(404).json({ error: 'Dispute was not found.' });
  return res.json({ dispute: safeDispute(dispute, req.user) });
});

module.exports = { router, reasons, disputeInput, invalidInput, isComplainant, isRespondent, disputeParties };
