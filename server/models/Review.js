const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  reviewerRole: { type: String, enum: ['client', 'model', 'photographer', 'agency'], required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  recipientRole: { type: String, enum: ['model', 'photographer', 'agency'], required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  reviewText: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true });

reviewSchema.index(
  { reviewerId: 1, reviewerRole: 1, recipientId: 1, recipientRole: 1 },
  { unique: true }
);

module.exports = mongoose.model('Review', reviewSchema);
