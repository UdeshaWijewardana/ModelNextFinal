const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');
const ChatMessage = require('../models/ChatMessage');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');
const { fail, assertId, chatAccess, transaction, safeHandler } = require('../services/eventChatService');
const { messageKey, textInput, retryFilter, assertSamePayload, serializeMessages, sendTextMessage, publishCommittedMessage } = require('../services/eventChatMessageService');
const { MAX_IMAGE_BYTES, normalizeImage, saveImage, removeImage, imagePath } = require('../services/eventChatImageService');

const router = express.Router();
router.use(requireUser, requireDatabase);

const cursorFor = (message) => Buffer.from(JSON.stringify({ id: String(message._id), at: new Date(message.createdAt).toISOString() })).toString('base64url');
const readCursor = (raw) => {
  if (typeof raw !== 'string' || raw.length > 200 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw fail(400, 'Invalid message cursor.');
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    assertId(value.id, 'message cursor ID');
    if (typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at)) || new Date(value.at).toISOString() !== value.at) throw new Error('Invalid date');
    return { id: value.id, at: new Date(value.at) };
  } catch (_error) { throw fail(400, 'Invalid message cursor.'); }
};

router.get('/:chatId/messages', safeHandler(async (req, res) => {
  const { chat } = await chatAccess(req.params.chatId, req.user);
  const rawLimit = req.query.limit === undefined ? '30' : req.query.limit;
  if (typeof rawLimit !== 'string' || !/^\d{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 100) throw fail(400, 'Limit must be between 1 and 100.');
  const limit = Number(rawLimit);
  const cursor = req.query.before === undefined ? null : readCursor(req.query.before);
  const filter = { chatId: chat._id, isDeleted: false };
  if (cursor) filter.$or = [{ createdAt: { $lt: cursor.at } }, { createdAt: cursor.at, _id: { $lt: cursor.id } }];
  const rows = await ChatMessage.find(filter).select('_id chatId senderId senderRole clientMessageId messageType text image.mimeType image.size image.width image.height createdAt')
    .sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const selected = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? cursorFor(selected[selected.length - 1]) : null;
  return res.json({ messages: await serializeMessages(selected.reverse()), nextCursor });
}));

router.post('/:chatId/messages', safeHandler(async (req, res) => {
  const result = await sendTextMessage(req.params.chatId, req.user, req.body);
  publishCommittedMessage(req, result);
  return res.status(result.replay ? 200 : 201).json(result);
}));

// Bound resource use before buffering or decoding. This is a per-process guard;
// a reverse proxy/shared limiter is still appropriate for multi-instance hosting.
const uploadCounts = new Map();
let activeUploads = 0;
const upload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: MAX_IMAGE_BYTES, files: 1, fields: 2, parts: 3, fieldSize: 20000,
} }).single('image');
const receiveImage = (req, res, next) => {
  const now = Date.now();
  for (const [key, entry] of uploadCounts) if (entry.until <= now) uploadCounts.delete(key);
  const userKey = `${req.user.role}:${req.user.id}`;
  const entry = uploadCounts.get(userKey) || { count: 0, until: now + 60000 };
  if (entry.count >= 10 || activeUploads >= 4 || (!uploadCounts.has(userKey) && uploadCounts.size >= 10000)) {
    res.set('Retry-After', '60');
    return res.status(429).json({ error: 'Too many image uploads. Please try again shortly.' });
  }
  entry.count += 1;
  uploadCounts.set(userKey, entry);
  activeUploads += 1;
  let released = false;
  const release = () => { if (!released) { released = true; activeUploads -= 1; } };
  res.once('finish', release);
  res.once('close', release);
  upload(req, res, (error) => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds the 5 MiB limit.' : 'Invalid image upload. Send one image and the message fields only.' });
    next();
  });
};

const authorizeUpload = async (req, res, next) => {
  try { await chatAccess(req.params.chatId, req.user); next(); }
  catch (error) { return safeHandler(async () => { throw error; })(req, res); }
};

router.post('/:chatId/messages/images', authorizeUpload, receiveImage, safeHandler(async (req, res) => {
  const key = messageKey(req.body);
  const text = textInput(req.body?.text === undefined ? '' : req.body.text, false);
  const image = await normalizeImage(req.file?.buffer);
  const storageKey = await saveImage(image);
  let committed = false;
  try {
    // Preallocate the ID so only the protected route is persisted as imageUrl.
    const messageId = new mongoose.Types.ObjectId();
    const result = await transaction(async (session) => {
      const { chat } = await chatAccess(req.params.chatId, req.user, 'member', session);
      const existing = await ChatMessage.findOne(retryFilter(chat._id, req.user, key)).select('+image.digest').session(session);
      if (existing) {
        assertSamePayload(existing, 'image', text, image.digest);
        return { message: existing, replay: true };
      }
      const [message] = await ChatMessage.create([{
        _id: messageId, ...retryFilter(chat._id, req.user, key), messageType: 'image', text,
        imageUrl: `/api/event-chats/${chat._id}/messages/${messageId}/image`,
        image: { storageKey, mimeType: image.mimeType, size: image.size, width: image.width, height: image.height, digest: image.digest },
      }], { session });
      return { message, replay: false };
    });
    committed = true;
    if (result.replay) await removeImage(storageKey);
    const response = { message: (await serializeMessages([result.message]))[0], replay: result.replay };
    publishCommittedMessage(req, response);
    return res.status(result.replay ? 200 : 201).json(response);
  } catch (error) {
    // An uncertain commit may reference this file. Retain it for reconciliation
    // rather than breaking a message that may have committed successfully.
    if (!committed && !error.hasErrorLabel?.('UnknownTransactionCommitResult')) await removeImage(storageKey);
    throw error;
  }
}));

router.get('/:chatId/messages/:messageId/image', safeHandler(async (req, res) => {
  assertId(req.params.messageId, 'message ID');
  const { chat } = await chatAccess(req.params.chatId, req.user);
  const message = await ChatMessage.findOne({ _id: req.params.messageId, chatId: chat._id, messageType: 'image', isDeleted: false })
    .select('+image.storageKey image.mimeType');
  if (!message?.image?.storageKey) throw fail(404, 'Chat image not found.');
  let file;
  try { file = await fs.open(imagePath(message.image.storageKey), 'r'); }
  catch (error) { if (error.code === 'ENOENT') throw fail(404, 'Chat image not found.'); throw error; }
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw fail(404, 'Chat image not found.');
    res.set({
      'Content-Type': 'image/webp', 'Content-Length': String(stat.size),
      'Content-Disposition': 'inline; filename="chat-image.webp"',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    await pipeline(file.createReadStream({ autoClose: false }), res);
  } finally { await file.close(); }
}));

module.exports = router;