const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { USER_SESSION_COOKIE, readCookie } = require('../utils/sessionCookies');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');
const Agency = require('../models/Agency');
const Client = require('../models/Client');

const regularRoles = new Set(['model', 'photographer', 'agency', 'client']);
const accountModels = { model: ModelUser, photographer: Photographer, agency: Agency, client: Client };

const requireUser = async (req, res, next) => {
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
    const account = await accountModels[payload.role].findById(payload.sub).select('approvalStatus');
    if (!account) return res.status(401).json({ error: 'Authentication is invalid or expired.' });
    if (account.approvalStatus !== 'approved') {
      const error = account.approvalStatus === 'rejected'
        ? 'Your registration has been rejected. Contact support if you need assistance.'
        : 'Your registration is pending administrator approval.';
      return res.status(403).json({ error });
    }
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Authentication is invalid or expired.' });
  }
};

module.exports = { requireUser, regularRoles };
