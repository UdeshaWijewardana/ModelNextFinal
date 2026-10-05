const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const bcrypt = require('bcryptjs');
const { requireDatabase } = require('../middleware/requireDatabase');

router.post('/register', requireDatabase, async (req, res) => {
  try {
    const { type, name, username, phone, email, address, password } = req.body || {};
    if (![type, name, username, phone, email, address, password].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'All registration fields are required.' });
    }
    const newClient = new Client({ type, name, username, phone, email: email.trim().toLowerCase(), address, password: await bcrypt.hash(password, 12) });
    await newClient.save();
    res.status(201).json({ message: "Client registered successfully", client: { id: newClient._id, name: newClient.name, email: newClient.email, approvalStatus: newClient.approvalStatus } });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
