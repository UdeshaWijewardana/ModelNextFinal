const mongoose = require('mongoose');

const modelSchema = new mongoose.Schema({
  fullName: { type: String, required: true },

  // ❌ removed required (important)
  username: { type: String },
  address: { type: String },

  idType: { type: String, required: true },

  phone: { type: String },
  birthdate: { type: String, required: true },

  location: { type: String },
  gender: { type: String },

  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  categories: [{ type: String }],

  profileImage: { type: String },
  portfolioImages: [{ type: String }],

  // ID images
  idFront: { type: String, required: true },
  idBack: { type: String },

  verificationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  }

}, { timestamps: true });

module.exports = mongoose.model('ModelUser', modelSchema);