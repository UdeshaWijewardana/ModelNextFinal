const express = require('express');
const bcrypt = require('bcryptjs');
const Agency = require('../models/Agency');
const Client = require('../models/Client');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');
const { USER_SESSION_COOKIE, cookieOptions, clearCookie, issueUserSession } = require('../utils/sessionCookies');

const router = express.Router();
const accountModels = { model: ModelUser, photographer: Photographer, agency: Agency, client: Client };
const bcryptHashPattern = /^\$2[aby]\$\d{2}\$/;
const accountName = (role, account) => role === 'model' ? account.fullName : (account.name || account.agencyName);

const safeAccount = (role, account) => {
  const base = { id: account._id, role, name: accountName(role, account), email: account.email };
  if (role === 'model') return { ...base, fullName: account.fullName, username: account.username, address: account.address, phone: account.phone, birthdate: account.birthdate, location: account.location, gender: account.gender, categories: account.categories, profileImage: account.profileImage, portfolioImages: account.portfolioImages, weight: account.weight, height: account.height, waist: account.waist, hip: account.hip, approvalStatus: account.approvalStatus, rejectionReason: account.rejectionReason, verificationStatus: account.verificationStatus };
  if (role === 'photographer') return { ...base, phone: account.phone, location: account.location, portfolio: account.portfolio, profileImage: account.profileImage, approvalStatus: account.approvalStatus, rejectionReason: account.rejectionReason };
  if (role === 'agency') return { ...base, agencyName: account.agencyName, ownerName: account.ownerName, phone: account.phone, address: account.address, businessId: account.businessId, profileImage: account.profileImage, coverImage: account.coverImage, approvalStatus: account.approvalStatus, rejectionReason: account.rejectionReason };
  return { ...base, type: account.type, username: account.username, phone: account.phone, address: account.address };
};

const getAccount = (role, id) => accountModels[role].findById(id);

const canUsePassword = async (account, submittedPassword) => {
  if (!account.password) return false;
  if (bcryptHashPattern.test(account.password)) return bcrypt.compare(submittedPassword, account.password);
  if (account.password !== submittedPassword) return false;
  account.password = await bcrypt.hash(submittedPassword, 12);
  await account.save();
  return true;
};

router.post('/login', requireDatabase, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'User authentication is not configured.' });
  try {
    const candidates = await Promise.all(Object.entries(accountModels).map(async ([role, Model]) => ({ role, account: await Model.findOne({ email }).select('+password') })));
    const matched = [];
    for (const candidate of candidates) if (candidate.account && await canUsePassword(candidate.account, password)) matched.push(candidate);
    if (matched.length !== 1) return res.status(401).json({ error: 'Invalid email or password.' });
    const { role, account } = matched[0];
    if (account.approvalStatus !== 'approved') {
      const error = account.approvalStatus === 'rejected'
        ? 'Your registration has been rejected. Contact support if you need assistance.'
        : 'Your registration is pending administrator approval.';
      return res.status(403).json({ error });
    }
    res.cookie(USER_SESSION_COOKIE, issueUserSession(account, role), cookieOptions());
    return res.json({ message: 'Login successful.', user: safeAccount(role, account) });
  } catch (error) {
    console.error('Regular user login failed:', error.message);
    return res.status(500).json({ error: 'Unable to sign in.' });
  }
});

router.get('/me', requireUser, requireDatabase, async (req, res) => {
  try {
    const account = await getAccount(req.user.role, req.user.id);
    if (!account) return res.status(401).json({ error: 'Authentication is invalid or expired.' });
    return res.json({ user: safeAccount(req.user.role, account) });
  } catch (error) {
    return res.status(error.name === 'CastError' ? 401 : 500).json({ error: 'Unable to load account information.' });
  }
});

router.post('/logout', (req, res) => { clearCookie(res, USER_SESSION_COOKIE); return res.status(204).end(); });

const editableFields = {
  model: ['fullName', 'username', 'address', 'phone', 'birthdate', 'location', 'gender', 'categories', 'profileImage', 'portfolioImages', 'weight', 'height', 'waist', 'hip'],
  photographer: ['name', 'phone', 'location', 'portfolio', 'profileImage'],
  agency: ['agencyName', 'ownerName', 'phone', 'address', 'businessId', 'profileImage', 'coverImage'],
  client: ['name', 'username', 'phone', 'address'],
};

router.patch('/me/profile', requireUser, requireDatabase, async (req, res) => {
  try {
    const account = await getAccount(req.user.role, req.user.id);
    if (!account) return res.status(401).json({ error: 'Authentication is invalid or expired.' });
    if (req.user.role !== 'client' && account.approvalStatus !== 'approved') {
      return res.status(403).json({ error: account.approvalStatus === 'rejected' ? 'Profile editing is unavailable for this account.' : 'Profile editing is unavailable until administrator approval.' });
    }
    const changes = {};
    for (const field of editableFields[req.user.role]) if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) changes[field] = req.body[field];
    if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'No editable profile fields were provided.' });
    Object.assign(account, changes);
    await account.save();
    return res.json({ user: safeAccount(req.user.role, account) });
  } catch (error) {
    return res.status(error.name === 'CastError' ? 401 : 500).json({ error: 'Unable to update profile.' });
  }
});

module.exports = { router, safeAccount, accountModels };
