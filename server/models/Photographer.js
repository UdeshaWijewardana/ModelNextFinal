const mongoose = require('mongoose');

const photographerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  location: { type: String, required: true },
  portfolio: { type: String }, // Website / Link
  password: { type: String, required: true, select: false },
  profileImage: { type: String },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  rejectionReason: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Photographer', photographerSchema);
