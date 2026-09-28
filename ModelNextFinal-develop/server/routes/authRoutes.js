const express = require('express');
const router = express.Router();
const Agency = require('../models/Agency');
const Client = require('../models/Client');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');

router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    
    if (email) {
      email = email.toLowerCase();
    }

    let user = null;
    let role = null;

    // Use a case-insensitive regex to find the email
    const emailRegex = new RegExp(`^${email}$`, 'i');

    user = await Agency.findOne({ email: emailRegex });
    if (user) role = 'agency';
    
    if (!user) {
      user = await Client.findOne({ email: emailRegex });
      if (user) role = 'client';
    }

    if (!user) {
      user = await ModelUser.findOne({ email: emailRegex });
      if (user) role = 'model';
    }

    if (!user) {
      user = await Photographer.findOne({ email: emailRegex });
      if (user) role = 'photographer';
    }

    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    // In a real application, you must use bcrypt.compare here
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid password" });
    }

    res.json({ message: "Login successful", user, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

module.exports = router;
