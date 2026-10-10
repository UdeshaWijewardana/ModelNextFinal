const express = require('express');
const Event = require('../models/Event');
const EventChat = require('../models/EventChat');
const ChatInvitation = require('../models/ChatInvitation');
const ChatJoinRequest = require('../models/ChatJoinRequest');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');
const {
  accounts, fail, assertId, sameAccount, isOwner, isMember, approvedAccount,
  chatAccess, addMember, transaction, notify, publicAccount, profileMap,
  pageOptions, listPage, statusFilter, safeHandler,
} = require('../services/eventChatService');

const router = express.Router();
router.use(requireUser, requireDatabase);

const invitationFields = '_id chatId invitedUserId invitedUserRole invitedById invitedByRole status respondedAt createdAt';
const requestFields = '_id chatId requestedById requestedByRole status reviewedById reviewedAt createdAt';
const eventSummaries = async (chatIds) => {
  const chats = await EventChat.find({ _id: { $in: chatIds } }).select('_id eventId').lean();
  const events = await Event.find({ _id: { $in: chats.map((chat) => chat.eventId) }, status: 'approved' }).select('_id title').lean();
  const titles = new Map(events.map((event) => [String(event._id), event.title]));
  return new Map(chats.map((chat) => [String(chat._id), {
    eventId: chat.eventId, eventTitle: titles.get(String(chat.eventId)) || null,
    available: titles.has(String(chat.eventId)),
  }]));
};
const summarizeList = async (page) => {
  const summaries = await eventSummaries(page.items.map((item) => item.chatId));
  return page.items.map((item) => ({ ...item, chat: summaries.get(String(item.chatId)) || { available: false } }));
};

router.get('/invitations/mine', safeHandler(async (req, res) => {
  const page = await listPage(ChatInvitation, {
    invitedUserId: req.user.id, invitedUserRole: req.user.role,
    ...statusFilter(req.query.status, ['pending', 'accepted', 'declined']),
  }, req.query, invitationFields);
  return res.json({ invitations: await summarizeList(page), nextCursor: page.nextCursor });
}));

router.get('/join-requests/mine', safeHandler(async (req, res) => {
  const page = await listPage(ChatJoinRequest, {
    requestedById: req.user.id, requestedByRole: req.user.role,
    ...statusFilter(req.query.status, ['pending', 'approved', 'rejected']),
  }, req.query, requestFields);
  return res.json({ requests: await summarizeList(page), nextCursor: page.nextCursor });
}));

router.get('/mine', safeHandler(async (req, res) => {
  const page = await listPage(EventChat, { $or: [
    { ownerId: req.user.id, ownerRole: req.user.role },
    { members: { $elemMatch: { userId: req.user.id, role: req.user.role } } },
  ] }, req.query, '_id eventId ownerId ownerRole createdAt');
  const summaries = await eventSummaries(page.items.map((chat) => chat._id));
  const chats = page.items.filter((chat) => summaries.get(String(chat._id))?.available).map((chat) => ({
    id: chat._id, ...summaries.get(String(chat._id)), isOwner: isOwner(chat, req.user), createdAt: chat.createdAt,
  }));
  return res.json({ chats, nextCursor: page.nextCursor });
}));

// Safe event-page discovery. Never return members or messages to nonmembers.
router.get('/events/:eventId/chat', safeHandler(async (req, res) => {
  assertId(req.params.eventId, 'event ID');
  const event = await Event.findOne({ _id: req.params.eventId, status: 'approved' }).select('_id ownerId ownerRole');
  if (!event) throw fail(404, 'Approved event not found.');
  const chat = await EventChat.findOne({ eventId: event._id });
  const ownsEvent = sameAccount(event.ownerId, event.ownerRole, req.user);
  if (!chat) return res.json({ chat: null, canCreate: ownsEvent });
  const [invitation, request] = await Promise.all([
    ChatInvitation.findOne({ chatId: chat._id, invitedUserId: req.user.id, invitedUserRole: req.user.role }).select('_id status'),
    ChatJoinRequest.findOne({ chatId: chat._id, requestedById: req.user.id, requestedByRole: req.user.role }).select('_id status'),
  ]);
  return res.json({ chat: { id: chat._id, isOwner: isOwner(chat, req.user), isMember: isMember(chat, req.user) }, invitation, request, canCreate: false });
}));

router.get('/:chatId/users', safeHandler(async (req, res) => {
  await chatAccess(req.params.chatId, req.user, 'owner');
  const Account = accounts.get(req.query.role);
  if (!Account) throw fail(400, 'Specify a valid account role.');
  const q = req.query.q === undefined ? '' : req.query.q;
  if (typeof q !== 'string' || q.length > 80) throw fail(400, 'Search must be a string of at most 80 characters.');
  const nameField = req.query.role === 'model' ? 'fullName' : req.query.role === 'agency' ? 'agencyName' : 'name';
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const page = await listPage(Account, {
    approvalStatus: 'approved', ...(escaped ? { [nameField]: { $regex: escaped, $options: 'i' } } : {}),
  }, req.query, '_id fullName name agencyName');
  return res.json({ users: page.items.map((account) => publicAccount(account, req.query.role)), nextCursor: page.nextCursor });
}));

router.get('/:chatId/invitations', safeHandler(async (req, res) => {
  const { chat } = await chatAccess(req.params.chatId, req.user, 'owner');
  const page = await listPage(ChatInvitation, { chatId: chat._id, ...statusFilter(req.query.status, ['pending', 'accepted', 'declined']) }, req.query, invitationFields);
  const profiles = await profileMap(page.items.map((item) => ({ id: item.invitedUserId, role: item.invitedUserRole })));
  return res.json({ invitations: page.items.map((item) => ({ ...item, recipient: profiles.get(`${item.invitedUserRole}:${item.invitedUserId}`) || null })), nextCursor: page.nextCursor });
}));

router.post('/:chatId/join-requests', safeHandler(async (req, res) => {
  assertId(req.params.chatId, 'chat ID');
  const request = await transaction(async (session) => {
    const { chat } = await chatAccess(req.params.chatId, req.user, 'approved', session);
    if (isOwner(chat, req.user) || isMember(chat, req.user)) throw fail(409, 'You already have chat access.');
    const existing = await ChatJoinRequest.findOne({ chatId: chat._id, requestedById: req.user.id, requestedByRole: req.user.role }).session(session);
    if (existing) throw fail(409, 'A join request already exists for this account and chat.');
    const [created] = await ChatJoinRequest.create([{
      chatId: chat._id, requestedById: req.user.id, requestedByRole: req.user.role, status: 'pending',
    }], { session });
    await notify({ id: chat.ownerId, role: chat.ownerRole }, 'chat_join_requested', 'A user requested access to your event group chat.', session);
    return created;
  });
  return res.status(201).json({ request: {
    id: request._id, chatId: request.chatId, status: request.status, createdAt: request.createdAt,
  } });
}));

router.get('/:chatId/join-requests', safeHandler(async (req, res) => {
  const { chat } = await chatAccess(req.params.chatId, req.user, 'owner');
  const page = await listPage(ChatJoinRequest, { chatId: chat._id, ...statusFilter(req.query.status, ['pending', 'approved', 'rejected']) }, req.query, requestFields);
  const profiles = await profileMap(page.items.map((item) => ({ id: item.requestedById, role: item.requestedByRole })));
  return res.json({ requests: page.items.map((item) => ({ ...item, requester: profiles.get(`${item.requestedByRole}:${item.requestedById}`) || null })), nextCursor: page.nextCursor });
}));

router.patch('/join-requests/:requestId/respond', safeHandler(async (req, res) => {
  assertId(req.params.requestId, 'join request ID');
  const { action } = req.body || {};
  if (action !== 'approve' && action !== 'reject') throw fail(400, 'Action must be approve or reject.');
  const request = await transaction(async (session) => {
    const existing = await ChatJoinRequest.findById(req.params.requestId).session(session);
    if (!existing) throw fail(404, 'Join request not found.');
    const { chat } = await chatAccess(existing.chatId, req.user, 'owner', session);
    if (existing.status !== 'pending') throw fail(409, 'This join request has already been reviewed.');
    const requester = { id: existing.requestedById, role: existing.requestedByRole };
    if (action === 'approve') await approvedAccount(requester, session);
    const reviewedAt = new Date();
    const updated = await ChatJoinRequest.findOneAndUpdate(
      { _id: existing._id, status: 'pending' },
      { $set: { status: action === 'approve' ? 'approved' : 'rejected', reviewedById: req.user.id, reviewedAt } },
      { new: true, session, runValidators: true }
    );
    if (!updated) throw fail(409, 'This join request has already been reviewed.');
    if (action === 'approve') await addMember(chat._id, requester, session, reviewedAt);
    await notify(requester, action === 'approve' ? 'chat_join_approved' : 'chat_join_rejected', `Your event group chat join request was ${updated.status}.`, session);
    return { id: updated._id, chatId: updated.chatId, status: updated.status, reviewedAt: updated.reviewedAt };
  });
  return res.json({ request });
}));

router.get('/:chatId/members', safeHandler(async (req, res) => {
  const { chat } = await chatAccess(req.params.chatId, req.user, 'reader');
  const { limit, before } = pageOptions(req.query);
  // Membership has no subdocument ID. Use a stable account-ID/role key cursor.
  // The separate memberBefore cursor also handles IDs shared across collections.
  if (before) throw fail(400, 'Use memberBefore for member pagination.');
  const cursor = req.query.memberBefore;
  if (cursor !== undefined && (typeof cursor !== 'string' || !/^[a-fA-F0-9]{24}:(model|photographer|agency|client)$/.test(cursor))) throw fail(400, 'Invalid member cursor.');
  const ordered = [...chat.members].sort((a, b) => `${a.userId}:${a.role}`.localeCompare(`${b.userId}:${b.role}`));
  const remaining = ordered.filter((member) => !cursor || `${member.userId}:${member.role}` > cursor);
  const selected = remaining.slice(0, limit);
  const profiles = await profileMap(selected.map((member) => ({ id: member.userId, role: member.role })));
  const members = selected.map((member) => ({
    id: member.userId, role: member.role, name: profiles.get(`${member.role}:${member.userId}`)?.name || 'Unavailable account',
    joinedAt: member.joinedAt, isOwner: sameAccount(member.userId, member.role, { id: chat.ownerId, role: chat.ownerRole }),
  }));
  const last = selected[selected.length - 1];
  return res.json({ members, nextCursor: remaining.length > limit ? `${last.userId}:${last.role}` : null });
}));

router.delete('/:chatId/members/:role/:userId', safeHandler(async (req, res) => {
  assertId(req.params.userId, 'member ID');
  if (!accounts.has(req.params.role)) throw fail(400, 'Invalid member role.');
  await transaction(async (session) => {
    const { chat } = await chatAccess(req.params.chatId, req.user, 'owner', session);
    const member = { id: req.params.userId, role: req.params.role };
    if (isOwner(chat, member)) throw fail(409, 'The chat owner cannot be removed.');
    if (!isMember(chat, member)) throw fail(404, 'Chat member not found.');
    await EventChat.updateOne({ _id: chat._id }, { $pull: { members: { userId: member.id, role: member.role } } }, { session });
    await notify(member, 'chat_member_removed', 'Your access to an event group chat was removed.', session);
  });
  const realtime = req.app.get('eventChatRealtime');
  if (realtime) {
    try { await realtime.revokeMember(req.params.chatId, { id: req.params.userId, role: req.params.role }); }
    catch (_error) { console.error('Immediate socket eviction failed; delivery authorization still applies.'); }
  }
  return res.status(204).end();
}));

router.get('/:chatId', safeHandler(async (req, res) => {
  const { chat, event } = await chatAccess(req.params.chatId, req.user, 'reader');
  return res.json({ chat: {
    id: chat._id, eventId: event._id, eventTitle: event.title, ownerId: chat.ownerId,
    ownerRole: chat.ownerRole, isOwner: isOwner(chat, req.user), memberCount: chat.members.length, createdAt: chat.createdAt,
  } });
}));

module.exports = router;