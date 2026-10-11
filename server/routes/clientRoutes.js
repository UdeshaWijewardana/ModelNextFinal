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
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    if (!['company', 'individual'].includes(type)) return res.status(400).json({ error: 'Choose a valid client type.' });
    if (!/^[a-z0-9._-]{3,40}$/.test(normalizedUsername)) return res.status(400).json({ error: 'Username must use 3–40 letters, numbers, dots, hyphens, or underscores.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !/^[+()\-\s0-9]{7,25}$/.test(phone.trim())) return res.status(400).json({ error: 'Enter a valid email address and contact number.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (await Client.exists({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] })) return res.status(409).json({ error: 'Email or username already exists.' });
    const newClient = new Client({ type, name: name.trim(), username: normalizedUsername, phone: phone.trim(), email: normalizedEmail, address: address.trim(), password: await bcrypt.hash(password, 12) });
    await newClient.save();
    res.status(201).json({ message: "Client registered successfully", client: { id: newClient._id, name: newClient.name, email: newClient.email, approvalStatus: newClient.approvalStatus } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: error.keyPattern?.username ? 'Username already exists.' : 'Email already exists.' });
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
