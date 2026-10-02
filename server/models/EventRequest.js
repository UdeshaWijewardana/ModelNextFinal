const mongoose = require('mongoose');

const eventRequestSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  requesterRole: { type: String, enum: ['model', 'photographer'], required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'declined'], default: 'pending' },
}, { timestamps: true });

eventRequestSchema.index({ eventId: 1, requesterId: 1 }, { unique: true });
module.exports = mongoose.model('EventRequest', eventRequestSchema);
