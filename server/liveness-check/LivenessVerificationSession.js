const mongoose = require('mongoose');

// Liveness session ekaka token hashes, status, kalasima saha evidence file references MongoDB eke thiyaganna schema eka.
const livenessVerificationSessionSchema = new mongoose.Schema({
  // Raw tokens nemei, ewa hash karapu values store karala session lookup/authentication karanawa.
  tokenHash: { type: String, required: true, unique: true },
  attemptIdHash: { type: String, required: true },
  // Session eka pending idan completed, consuming, consumed kiyala yanna puluwan.
  status: {
    type: String,
    enum: ['pending', 'completed', 'consuming', 'consumed'],
    required: true,
    default: 'pending',
  },
  // Session hadapu wela saha expire wena wela; expiresAt TTL index eken expired record cleanup karanawa.
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  // Complete saha registration eken consume karapu welawal audit/reference walata save wenawa.
  completedAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null },
  // Registration review ekata FRONT, LEFT, RIGHT images wala path, digest saha capture welaawa thiyagannawa.
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
