const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { USER_SESSION_COOKIE, readCookie } = require('../utils/sessionCookies');

const regularRoles = new Set(['model', 'photographer', 'agency', 'client']);

const requireUser = (req, res, next) => {
  const token = readCookie(req, USER_SESSION_COOKIE);
  if (!token) return res.status(401).json({ error: 'Authentication is required.' });
  if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'User authentication is not configured.' });
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database service is currently unavailable. Please try again later.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.sub || !regularRoles.has(payload.role)) {
      return res.status(401).json({ error: 'Authentication is invalid or expired.' });
    }
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Authentication is invalid or expired.' });
  }
};

module.exports = { requireUser, regularRoles };
