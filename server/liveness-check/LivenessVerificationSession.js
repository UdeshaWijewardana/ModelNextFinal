const mongoose = require('mongoose');

const livenessVerificationSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  attemptIdHash: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'consuming', 'consumed'],
    required: true,
    default: 'pending',
  },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  completedAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null },
  evidence: {
    front: {
      path: { type: String },
      digest: { type: String },
      capturedAt: { type: Date },
    },
    left: {
      path: { type: String },
      digest: { type: String },
      capturedAt: { type: Date },
    },
    right: {
      path: { type: String },
      digest: { type: String },
      capturedAt: { type: Date },
    },
  },
}, { versionKey: false });

module.exports = mongoose.model('LivenessVerificationSession', livenessVerificationSessionSchema);
