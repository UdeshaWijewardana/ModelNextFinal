const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const { ADMIN_SESSION_COOKIE, readCookie } = require('../utils/sessionCookies');

const getBearerToken = (authorization = '') => {
  const [scheme, token] = authorization.split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

const requireAdmin = async (req, res, next) => {
  const token = readCookie(req, ADMIN_SESSION_COOKIE) || getBearerToken(req.get('authorization'));
  if (!token) {
    return res.status(401).json({ error: 'Administrator authentication is required.' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Administrator authentication is not configured.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database service is currently unavailable. Please try again later.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin' || !payload.sub) {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }

    const admin = await Admin.findById(payload.sub).select('_id name email role');
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Administrator authentication is invalid or expired.' });
  }
};

module.exports = { requireAdmin };
