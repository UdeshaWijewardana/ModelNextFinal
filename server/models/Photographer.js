
const mongoose = require('mongoose');

const photographerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
  },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  location: { type: String, required: true },
  experienceYears: { type: Number, min: 0 },
  portfolio: { type: String }, // Website / Link
  password: { type: String, required: true, select: false },
  profileImage: { type: String },

  // New fields for photographer matching
  photographyStyles: [{
    type: String,
    trim: true,
  }],

  skills: [{
    type: String,
    trim: true,
  }],

  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvedAt: { type: Date },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  rejectionReason: { type: String, trim: true },

  manualAvailability: [{
    date: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    status: {
      type: String,
      enum: ['available', 'unavailable'],
    },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Photographer', photographerSchema);
