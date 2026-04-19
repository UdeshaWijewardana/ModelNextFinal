const mongoose = require('mongoose');

const modelSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  username: { type: String, required: true },
  address: { type: String, required: true },
  idType: { type: String, required: true },
  phone: { type: String, required: true },
  birthdate: { type: String, required: true },
  location: { type: String, required: true },
  gender: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  categories: [{ type: String }],
  profileImage: { type: String },
  portfolioImages: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('ModelUser', modelSchema);
