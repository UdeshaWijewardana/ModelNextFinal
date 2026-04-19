const mongoose = require('mongoose');

const photographerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  location: { type: String, required: true },
  portfolio: { type: String }, // Website / Link
  password: { type: String, required: true },
  profileImage: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Photographer', photographerSchema);
