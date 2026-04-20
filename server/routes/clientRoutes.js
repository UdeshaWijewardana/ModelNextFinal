const express = require('express');
const router = express.Router();
const Client = require('../models/Client');

router.post('/register', async (req, res) => {
  try {
    const newClient = new Client(req.body);
    await newClient.save();
    res.status(201).json({ message: "Client registered successfully", client: newClient });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;
