const mongoose = require('mongoose');

const agencySchema = new mongoose.Schema({
  agencyName: { type: String, required: true },
  ownerName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  businessId: { type: String },
  password: { type: String, required: true, select: false },
  profileImage: { type: String }, // Path or URL to the image
  coverImage: { type: String }, // Path or URL to the image
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  rejectionReason: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Agency', agencySchema);
