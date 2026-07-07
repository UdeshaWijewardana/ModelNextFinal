const mongoose = require('mongoose');

const modelSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  username: { type: String },
  address: { type: String },
  idType: { type: String, required: true },
  phone: { type: String, required: true },
  birthdate: { type: String, required: true },
  location: { type: String, required: true },
  gender: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  categories: [{ type: String }],
  profileImage: { type: String },
  portfolioImages: [{ type: String }],
  idFrontImage: { type: String },
  idBackImage: { type: String },
  selfieMedia: { type: String },
  verificationStatus: { type: String, default: 'pending_ai_review' },
  verificationSummary: { type: String },
  aiConfidence: { type: Number },
  aiChecks: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('ModelUser', modelSchema);
