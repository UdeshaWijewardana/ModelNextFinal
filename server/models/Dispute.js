const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'DirectBooking', required: true, index: true },
  complainantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  complainantRole: { type: String, enum: ['client', 'agency', 'photographer', 'model'], required: true },
  respondentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  respondentRole: { type: String, enum: ['client', 'agency', 'photographer', 'model'], required: true },
  reason: { type: String, enum: ['No-show', 'Unprofessional behavior', 'Payment issue', 'Service quality', 'Harassment', 'Other'], required: true },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
  status: { type: String, enum: ['open', 'under_review', 'resolved'], default: 'open', index: true },
  adminResolution: { type: String, trim: true, maxlength: 1000 },
  resolvedAt: Date,
}, { timestamps: true });

disputeSchema.index(
  { bookingId: 1, complainantId: 1, complainantRole: 1 },
  { unique: true, partialFilterExpression: { $or: [{ status: 'open' }, { status: 'under_review' }] } }
);

module.exports = mongoose.model('Dispute', disputeSchema);
