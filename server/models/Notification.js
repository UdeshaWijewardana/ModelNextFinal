const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  recipientRole: { type: String, enum: ['model', 'photographer', 'agency', 'client'], required: true },
  type: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, recipientRole: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
