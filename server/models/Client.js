const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  type: { type: String, required: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  password: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
