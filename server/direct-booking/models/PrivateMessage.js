const mongoose = require('mongoose');

const privateMessageSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'DirectBooking', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderRole: { type: String, enum: ['client', 'agency', 'photographer', 'model'], required: true },
  senderName: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

privateMessageSchema.index({ bookingId: 1, createdAt: 1 });
module.exports = mongoose.model('PrivateMessage', privateMessageSchema);
