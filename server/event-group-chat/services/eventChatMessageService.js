const ChatMessage = require('../models/ChatMessage');
const { fail, assertId, chatAccess, transaction, profileMap } = require('./eventChatService');

const messageKey = (body) => {
  const key = body?.clientMessageId;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw fail(400, 'A clientMessageId of 8–100 letters, digits, underscores, or hyphens is required.');
  return key;
};
const textInput = (value, required) => {
  if (typeof value !== 'string' || value.length > 5000 || (required && !value.trim())) throw fail(400, 'Text must be a string of at most 5000 characters and cannot be empty for text messages.');
  return value.trim();
};
const retryFilter = (chatId, user, key) => ({ chatId, senderId: user.id, senderRole: user.role, clientMessageId: key });
const assertSamePayload = (message, type, text, digest) => {
  if (message.isDeleted || message.messageType !== type || message.text !== text || (type === 'image' && message.image?.digest !== digest)) {
    throw fail(409, 'This clientMessageId was already used for a different message.');
  }
};
const serializeMessages = async (messages) => {
  const profiles = await profileMap(messages.map((message) => ({ id: message.senderId, role: message.senderRole })));
  return messages.map((message) => ({
    id: message._id, chatId: message.chatId, clientMessageId: message.clientMessageId,
    sender: { id: message.senderId, role: message.senderRole, name: profiles.get(`${message.senderRole}:${message.senderId}`)?.name || 'Unavailable account' },
    messageType: message.messageType, text: message.text, createdAt: message.createdAt,
    ...(message.messageType === 'image' ? { image: {
      url: `/api/event-chats/${message.chatId}/messages/${message._id}/image`,
      mimeType: message.image?.mimeType, size: message.image?.size, width: message.image?.width, height: message.image?.height,
    } } : {}),
  }));
};

// Shared by REST and Socket.IO. Persistence and retry detection always precede
// serialization/publication. A duplicate never inserts or broadcasts again.
const sendTextMessage = async (chatId, user, body) => {
  assertId(chatId, 'chat ID');
  const key = messageKey(body);
  const text = textInput(body?.text, true);
  const result = await transaction(async (session) => {
    const { chat } = await chatAccess(chatId, user, 'member', session);
    const existing = await ChatMessage.findOne(retryFilter(chat._id, user, key)).session(session);
    if (existing) {
      assertSamePayload(existing, 'text', text);
      return { message: existing, replay: true };
    }
    const [message] = await ChatMessage.create([{
      ...retryFilter(chat._id, user, key), messageType: 'text', text,
    }], { session });
    return { message, replay: false };
  });
  return { message: (await serializeMessages([result.message]))[0], replay: result.replay };
};

// Live delivery is best effort after a durable commit. A delivery failure must
// never turn a successful REST write into an apparent database failure.
const publishCommittedMessage = (req, result) => {
  if (result.replay) return;
  const realtime = req.app.get('eventChatRealtime');
  if (realtime) realtime.publish(result.message).catch(() => {
    console.error('Event chat live delivery failed; message remains available in history.');
  });
};

module.exports = { messageKey, textInput, retryFilter, assertSamePayload, serializeMessages, sendTextMessage, publishCommittedMessage };