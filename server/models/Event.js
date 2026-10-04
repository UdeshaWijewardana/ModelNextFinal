const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  eventType: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  location: { type: String, required: true, trim: true },
  organizerName: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  image: { type: String },

  // AI matching requirements
  requiredGender: { type: String, trim: true },
  minAge: { type: Number },
  maxAge: { type: Number },
  minHeight: { type: Number },
  maxHeight: { type: Number },
  requiredCategories: [{ type: String, trim: true }],
  requiredSkills: [{ type: String, trim: true }],

  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ownerRole: { type: String, enum: ['photographer', 'agency', 'client'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  rejectionReason: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);