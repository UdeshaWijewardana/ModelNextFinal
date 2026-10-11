const mongoose = require('mongoose');

const directBookingSchema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  requesterRole: { type: String, enum: ['client', 'agency', 'photographer'], required: true },
  requesterName: { type: String, required: true, trim: true },
  talentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  talentRole: { type: String, enum: ['model', 'photographer'], required: true },
  talentName: { type: String, required: true, trim: true },
  jobType: { type: String, enum: ['Commercial Shoot', 'Fashion Editorial', 'Runway', 'Portfolio Shoot', 'Product Shoot', 'Other'], required: true },
  bookingDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  location: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, trim: true, maxlength: 1500 },
  status: { type: String, enum: ['pending', 'confirmed', 'declined'], default: 'pending', index: true },
  respondedAt: Date,
}, { timestamps: true });

directBookingSchema.index({ talentId: 1, talentRole: 1, bookingDate: 1, status: 1 });
directBookingSchema.index({ talentId: 1, talentRole: 1, bookingDate: 1 }, { unique: true, partialFilterExpression: { status: 'confirmed' } });
module.exports = mongoose.model('DirectBooking', directBookingSchema);
