const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');
const Agency = require('../models/Agency');
const Client = require('../models/Client');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');

const router = express.Router();
const recipientModels = { model: ModelUser, photographer: Photographer, agency: Agency };
const reviewerModels = { client: Client, model: ModelUser, photographer: Photographer, agency: Agency };
const displayFields = { client: 'name', model: 'fullName', photographer: 'name', agency: 'agencyName' };
const validRecipientRoles = new Set(Object.keys(recipientModels));
const reviewValues = body => ({ rating: Number(body?.rating), reviewText: typeof body?.reviewText === 'string' ? body.reviewText.trim() : '' });
const validationError = ({ rating, reviewText }) => !Number.isInteger(rating) || rating < 1 || rating > 5 || reviewText.length > 1000;
const normalizeSummary = summary => ({ averageRating: summary ? Number(summary.averageRating.toFixed(1)) : 0, reviewCount: summary?.reviewCount || 0 });

const recipientExists = async (role, id) => recipientModels[role].exists({ _id: id, approvalStatus: 'approved' });
const summaryFor = async (role, id) => {
  const [summary] = await Review.aggregate([
    { $match: { recipientRole: role, recipientId: new mongoose.Types.ObjectId(id) } },
    { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);
  return normalizeSummary(summary);
};

const reviewerNames = async reviews => {
  const names = new Map();
  await Promise.all(Object.entries(reviewerModels).map(async ([role, Model]) => {
    const ids = reviews.filter(review => review.reviewerRole === role).map(review => review.reviewerId);
    if (!ids.length) return;
    const field = displayFields[role];
    const accounts = await Model.find({ _id: { $in: ids } }).select(field).lean();
    accounts.forEach(account => names.set(`${role}:${account._id}`, account[field]));
  }));
  return names;
};

const publicReview = (review, names) => ({
  id: review._id,
  rating: review.rating,
  reviewText: review.reviewText,
  reviewerName: names.get(`${review.reviewerRole}:${review.reviewerId}`) || 'Former ModelNext user',
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

router.get('/summaries/:recipientRole', requireDatabase, async (req, res) => {
  const { recipientRole } = req.params;
  const ids = String(req.query.ids || '').split(',').filter(mongoose.isObjectIdOrHexString).slice(0, 100);
  if (!validRecipientRoles.has(recipientRole) || !ids.length) return res.json({ summaries: {} });
  const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
  const rows = await Review.aggregate([
    { $match: { recipientRole, recipientId: { $in: objectIds } } },
    { $group: { _id: '$recipientId', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);
  const summaries = Object.fromEntries(ids.map(id => [id, { averageRating: 0, reviewCount: 0 }]));
  rows.forEach(row => { summaries[String(row._id)] = normalizeSummary(row); });
  return res.json({ summaries });
});

router.get('/:recipientRole/:recipientId/mine', requireUser, requireDatabase, async (req, res) => {
  const { recipientRole, recipientId } = req.params;
  if (!validRecipientRoles.has(recipientRole) || !mongoose.isObjectIdOrHexString(recipientId)) return res.status(400).json({ error: 'Invalid review recipient.' });
  const review = await Review.findOne({ reviewerId: req.user.id, reviewerRole: req.user.role, recipientId, recipientRole });
  return res.json({ review: review ? { id: review._id, rating: review.rating, reviewText: review.reviewText, createdAt: review.createdAt, updatedAt: review.updatedAt } : null });
});

router.get('/:recipientRole/:recipientId', requireDatabase, async (req, res) => {
  const { recipientRole, recipientId } = req.params;
  if (!validRecipientRoles.has(recipientRole) || !mongoose.isObjectIdOrHexString(recipientId) || !(await recipientExists(recipientRole, recipientId))) return res.status(404).json({ error: 'Review recipient was not found.' });
  const reviews = await Review.find({ recipientId, recipientRole }).sort({ createdAt: -1 }).limit(100).lean();
  const names = await reviewerNames(reviews);
  return res.json({ summary: await summaryFor(recipientRole, recipientId), reviews: reviews.map(review => publicReview(review, names)) });
});

router.post('/:recipientRole/:recipientId', requireUser, requireDatabase, async (req, res) => {
  const { recipientRole, recipientId } = req.params;
  const values = reviewValues(req.body);
  if (!validRecipientRoles.has(recipientRole) || !mongoose.isObjectIdOrHexString(recipientId)) return res.status(400).json({ error: 'Invalid review recipient.' });
  if (recipientRole === req.user.role && String(recipientId) === String(req.user.id)) return res.status(400).json({ error: 'You cannot review your own profile.' });
  if (validationError(values)) return res.status(400).json({ error: 'Rating must be an integer from 1 to 5 and feedback must be 1,000 characters or fewer.' });
  if (!(await recipientExists(recipientRole, recipientId))) return res.status(404).json({ error: 'Review recipient was not found.' });
  try {
    const review = await Review.create({ reviewerId: req.user.id, reviewerRole: req.user.role, recipientId, recipientRole, ...values });
    return res.status(201).json({ review: { id: review._id, rating: review.rating, reviewText: review.reviewText, createdAt: review.createdAt, updatedAt: review.updatedAt } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'You have already reviewed this profile.' });
    throw error;
  }
});

router.put('/:reviewId', requireUser, requireDatabase, async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.reviewId)) return res.status(400).json({ error: 'Invalid review ID.' });
  const values = reviewValues(req.body);
  if (validationError(values)) return res.status(400).json({ error: 'Rating must be an integer from 1 to 5 and feedback must be 1,000 characters or fewer.' });
  const review = await Review.findOneAndUpdate(
    { _id: req.params.reviewId, reviewerId: req.user.id, reviewerRole: req.user.role },
    { $set: values },
    { new: true, runValidators: true }
  );
  if (!review) return res.status(404).json({ error: 'Your review was not found.' });
  return res.json({ review: { id: review._id, rating: review.rating, reviewText: review.reviewText, createdAt: review.createdAt, updatedAt: review.updatedAt } });
});

router.delete('/:reviewId', requireUser, requireDatabase, async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.reviewId)) return res.status(400).json({ error: 'Invalid review ID.' });
  const review = await Review.findOneAndDelete({ _id: req.params.reviewId, reviewerId: req.user.id, reviewerRole: req.user.role });
  if (!review) return res.status(404).json({ error: 'Your review was not found.' });
  return res.status(204).end();
});

module.exports = { router, reviewValues, validationError, normalizeSummary };
