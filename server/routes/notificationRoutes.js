const express = require('express');
const Notification = require('../models/Notification');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');

const router = express.Router();

router.get('/', requireUser, requireDatabase, async (req, res) => {
  const notifications = await Notification.find({ recipientId: req.user.id, recipientRole: req.user.role }).sort({ createdAt: -1 });
  return res.json({ notifications });
});

router.patch('/:id/read', requireUser, requireDatabase, async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.user.id, recipientRole: req.user.role },
    { $set: { read: true } }, { new: true }
  );
  if (!notification) return res.status(404).json({ error: 'Notification was not found.' });
  return res.json({ notification });
});

module.exports = router;
