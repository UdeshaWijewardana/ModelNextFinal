const mongoose = require('mongoose');
const Event = require('../models/Event');
const EventChat = require('../models/EventChat');
const Notification = require('../models/Notification');
const accounts = new Map([
  ['model', require('../models/ModelUser')],
  ['photographer', require('../models/Photographer')],
  ['agency', require('../models/Agency')],
  ['client', require('../models/Client')],
]);

const fail = (status, message) => Object.assign(new Error(message), { chatStatus: status });
const assertId = (id, label = 'ID') => {
  if (typeof id !== 'string' || !mongoose.isObjectIdOrHexString(id)) throw fail(400, `Invalid ${label}.`);
};
const sameAccount = (id, role, user) => String(id).toLowerCase() === String(user.id).toLowerCase() && role === user.role;
const isOwner = (chat, user) => sameAccount(chat.ownerId, chat.ownerRole, user);
const isMember = (chat, user) => chat.members.some((member) => sameAccount(member.userId, member.role, user));
const useSession = (query, session) => session ? query.session(session) : query;

// A real write to the approval document prevents snapshot write skew against
// concurrent approval revocation/deletion. Use a dedicated internal field so
// unrelated Mongoose array saves keep their normal __v semantics. strict:false
// applies only to this fixed server-owned increment, never client update data.
const approvedAccount = async (user, session) => {
  const Account = accounts.get(user.role);
  if (!Account) throw fail(400, 'Invalid account role.');
  const filter = { _id: user.id, approvalStatus: 'approved' };
  const query = session
    ? Account.findOneAndUpdate(filter, { $inc: { _chatAccessVersion: 1 } }, { new: true, session, timestamps: false, strict: false })
    : Account.findOne(filter);
  const account = await query.select('_id fullName name agencyName');
  if (!account) throw fail(403, 'This account is no longer approved or available.');
  return account;
};

const chatAccess = async (chatId, user, access = 'member', session) => {
  assertId(String(chatId), 'chat ID');
  const chat = await useSession(EventChat.findById(chatId), session);
  if (!chat) throw fail(404, 'Event group chat not found.');
  if (access === 'owner' && !isOwner(chat, user)) throw fail(403, 'Only the chat owner can perform this action.');
  if (access === 'member' && !isMember(chat, user)) throw fail(403, 'Chat membership is required.');
  if (access === 'reader' && !isMember(chat, user) && !isOwner(chat, user)) throw fail(403, 'Chat access is required.');
  const query = session
    ? Event.findOneAndUpdate({ _id: chat.eventId, status: 'approved' }, { $inc: { _chatAccessVersion: 1 } }, { new: true, session, timestamps: false, strict: false })
    : Event.findOne({ _id: chat.eventId, status: 'approved' });
  const event = await query.select('_id title status');
  if (!event) {
    const existingEvent = await useSession(Event.findById(chat.eventId).select('_id'), session);
    if (!existingEvent) throw fail(404, 'Associated event not found.');
    throw fail(403, 'The associated event is no longer approved.');
  }
  if (session) {
    await approvedAccount(user, session);
    const locked = await EventChat.updateOne({ _id: chat._id }, { $inc: { _chatAccessVersion: 1 } }, { session, timestamps: false, strict: false });
    if (locked.matchedCount !== 1) throw fail(404, 'Event group chat not found.');
  }
  return { chat, event };
};

const addMember = async (chatId, user, session, joinedAt = new Date()) => {
  await EventChat.updateOne(
    { _id: chatId, members: { $not: { $elemMatch: { userId: user.id, role: user.role } } } },
    { $push: { members: { userId: user.id, role: user.role, joinedAt } } },
    { session, runValidators: true }
  );
};

const transaction = (work) => mongoose.connection.transaction(work, {
  readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 10000,
});
const notify = async (user, type, message, session) => {
  await Notification.create([{ recipientId: user.id, recipientRole: user.role, type, message }], session ? { session } : {});
};
const notifyBestEffort = async (user, type, message) => {
  try { await notify(user, type, message); }
  catch (_error) { console.error('Event chat notification could not be saved.'); }
};

const publicAccount = (account, role) => ({
  id: account._id,
  role,
  name: account.fullName || account.name || account.agencyName || 'Unavailable account',
  // Profile paths are intentionally omitted: existing account paths may contain
  // filesystem details. Chat discovery only needs identity and display name.
});
const profileMap = async (users) => {
  const result = new Map();
  await Promise.all([...accounts].map(async ([role, Account]) => {
    const ids = users.filter((user) => user.role === role).map((user) => user.id);
    if (!ids.length) return;
    const records = await Account.find({ _id: { $in: ids }, approvalStatus: 'approved' }).select('_id fullName name agencyName').lean();
    records.forEach((record) => result.set(`${role}:${record._id}`, publicAccount(record, role)));
  }));
  return result;
};

const pageOptions = (query) => {
  const raw = query.limit === undefined ? '30' : query.limit;
  if (typeof raw !== 'string' || !/^\d{1,3}$/.test(raw) || Number(raw) < 1 || Number(raw) > 100) throw fail(400, 'Limit must be between 1 and 100.');
  if (query.before !== undefined) assertId(query.before, 'pagination cursor');
  return { limit: Number(raw), before: query.before };
};
const listPage = async (Model, filter, query, projection) => {
  const { limit, before } = pageOptions(query);
  const rows = await Model.find({ ...filter, ...(before ? { _id: { $lt: before } } : {}) })
    .select(projection).sort({ _id: -1 }).limit(limit + 1).lean();
  const more = rows.length > limit;
  const items = rows.slice(0, limit);
  return { items, nextCursor: more ? String(items[items.length - 1]._id) : null };
};
const statusFilter = (value, allowed) => {
  if (value === undefined) return {};
  if (typeof value !== 'string' || !allowed.includes(value)) throw fail(400, 'Invalid status filter.');
  return { status: value };
};
const safeHandler = (handler) => async (req, res) => {
  try { await handler(req, res); }
  catch (error) {
    if (res.headersSent) return res.destroy();
    if (error.chatStatus) return res.status(error.chatStatus).json({ error: error.message });
    if (error.code === 20 || error.code === 303) return res.status(503).json({ error: 'This operation requires MongoDB transaction support (replica set or sharded deployment).' });
    if (error.hasErrorLabel?.('UnknownTransactionCommitResult')) return res.status(503).json({ error: 'Unable to confirm the result. Refresh its status before retrying.' });
    if (error.code === 11000 || error.hasErrorLabel?.('TransientTransactionError')) return res.status(409).json({ error: 'A duplicate or concurrent request conflicted. Refresh and retry if still pending.' });
    if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ error: 'Invalid event chat input.' });
    console.error('Event chat operation failed:', error.name, error.code || '');
    return res.status(500).json({ error: 'Unable to complete the event chat operation.' });
  }
};

module.exports = {
  accounts, fail, assertId, sameAccount, isOwner, isMember, approvedAccount,
  chatAccess, addMember, transaction, notify, notifyBestEffort, publicAccount,
  profileMap, pageOptions, listPage, statusFilter, safeHandler,
};