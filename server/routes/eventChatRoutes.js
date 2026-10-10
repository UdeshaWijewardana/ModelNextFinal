
const express = require('express');
const mongoose = require('mongoose');

const Event = require('../models/Event');
const EventChat = require('../models/EventChat');
const ChatInvitation = require('../models/ChatInvitation');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');
const Agency = require('../models/Agency');
const Client = require('../models/Client');

const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');
const { chatAccess, addMember, notify, notifyBestEffort } = require('../services/eventChatService');


const router = express.Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

const creatorRoles = new Set([
  'client',
  'photographer',
  'agency',
]);

// POST /api/event-chats/events/:eventId
// Create one group chat for an approved event.

router.post(
  '/events/:eventId',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const { eventId } = req.params;

      // Validate event ID.
      if (!mongoose.isValidObjectId(eventId)) {
        return res.status(400).json({
          error: 'Invalid event ID.',
        });
      }

      // Only event creator roles can create chats.
      if (!creatorRoles.has(req.user.role)) {
        return res.status(403).json({
          error: 'You cannot create an event group chat.',
        });
      }

      // Find the approved event owned by this user.
      const event = await Event.findOne({
        _id: eventId,
        ownerId: req.user.id,
        ownerRole: req.user.role,
        status: 'approved',
      });

      if (!event) {
        return res.status(404).json({
          error: 'Approved event not found or access denied.',
        });
      }

      // Prevent duplicate group chats.
      const existingChat = await EventChat.findOne({
        eventId: event._id,
      });

      if (existingChat) {
        return res.status(409).json({
          error: 'A group chat already exists for this event.',
        });
      }

      // Create the chat and add the owner as first member.
      const chat = await EventChat.create({
        eventId: event._id,
        ownerId: event.ownerId,
        ownerRole: event.ownerRole,
        members: [
          {
            userId: event.ownerId,
            role: event.ownerRole,
          },
        ],
      });

      return res.status(201).json({
        message: 'Event group chat created successfully.',
        chat: {
          id: chat._id,
          eventId: chat.eventId,
          ownerId: chat.ownerId,
          ownerRole: chat.ownerRole,
          members: chat.members,
          createdAt: chat.createdAt,
        },
      });
    } catch (error) {
      // Unique eventId index also prevents concurrent duplicates.
      if (error.code === 11000) {
        return res.status(409).json({
          error: 'A group chat already exists for this event.',
        });
      }

      console.error('Create event chat error:', error);

      return res.status(500).json({
        error: 'Unable to create the event group chat.',
      });
    }
  }
);

const invitationAccountModels = new Map([
  ['model', ModelUser],
  ['photographer', Photographer],
  ['agency', Agency],
  ['client', Client],
]);

// POST /api/event-chats/:chatId/invitations
// Invite an approved account without changing chat membership.
router.post(
  '/:chatId/invitations',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const { chatId } = req.params;
      const { invitedUserId, invitedUserRole } = req.body || {};

      if (!mongoose.isObjectIdOrHexString(chatId)) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }

      if (typeof invitedUserId !== 'string' || !mongoose.isObjectIdOrHexString(invitedUserId)) {
        return res.status(400).json({ error: 'Invalid invited user ID.' });
      }

      const Account = invitationAccountModels.get(invitedUserRole);
      if (!Account) {
        return res.status(400).json({ error: 'Invalid invited user role.' });
      }

      const chat = await EventChat.findById(chatId);
      if (!chat) {
        return res.status(404).json({ error: 'Event group chat not found.' });
      }

      // Both ID and role identify an account across the separate collections.
      if (!chat.ownerId.equals(req.user.id) || chat.ownerRole !== req.user.role) {
        return res.status(403).json({ error: 'Only the chat owner can send invitations.' });
      }

      const event = await Event.findById(chat.eventId).select('status');
      if (!event) {
        return res.status(404).json({ error: 'Associated event not found.' });
      }
      if (event.status !== 'approved') {
        return res.status(403).json({ error: 'Invitations require an approved event.' });
      }

      const invitedAccount = await Account.findById(invitedUserId).select('approvalStatus');
      if (!invitedAccount) {
        return res.status(404).json({ error: 'Invited account not found.' });
      }
      if (invitedAccount.approvalStatus !== 'approved') {
        return res.status(403).json({ error: 'Only approved accounts can be invited.' });
      }

      const isMember = chat.members.some((member) => (
        member.userId.equals(invitedUserId) && member.role === invitedUserRole
      ));
      if (isMember) {
        return res.status(409).json({ error: 'This account is already a chat member.' });
      }

      const invitationKey = {
        chatId: chat._id,
        invitedUserId: invitedAccount._id,
        invitedUserRole,
      };
      const existingInvitation = await ChatInvitation.findOne(invitationKey);
      if (existingInvitation) {
        return res.status(409).json({ error: 'An invitation already exists for this account in this chat.' });
      }

      const invitation = await ChatInvitation.create({
        ...invitationKey,
        invitedById: req.user.id,
        invitedByRole: req.user.role,
        status: 'pending',
      });

      await notifyBestEffort(
        { id: invitation.invitedUserId, role: invitation.invitedUserRole },
        'chat_invitation_received',
        'You received an invitation to an event group chat.'
      );

      return res.status(201).json({
        message: 'Event group chat invitation sent successfully.',
        invitation: {
          id: invitation._id,
          chatId: invitation.chatId,
          invitedUserId: invitation.invitedUserId,
          invitedUserRole: invitation.invitedUserRole,
          invitedById: invitation.invitedById,
          invitedByRole: invitation.invitedByRole,
          status: invitation.status,
          respondedAt: invitation.respondedAt,
          createdAt: invitation.createdAt,
        },
      });
    } catch (error) {
      // The compound unique index also prevents concurrent duplicates.
      if (error.code === 11000) {
        return res.status(409).json({ error: 'An invitation already exists for this account in this chat.' });
      }

      console.error('Create event chat invitation error:', error);
      return res.status(500).json({ error: 'Unable to send the event group chat invitation.' });
    }
  }
);

// PATCH /api/event-chats/invitations/:invitationId/respond
// Commit the response and any membership change together.
router.patch(
  '/invitations/:invitationId/respond',
  requireUser,
  requireDatabase,
  async (req, res) => {
    const { invitationId } = req.params;
    const { action } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(invitationId)) {
      return res.status(400).json({ error: 'Invalid invitation ID.' });
    }
    if (action !== 'accept' && action !== 'decline') {
      return res.status(400).json({ error: 'Action must be accept or decline.' });
    }

    const responseError = (status, message) => Object.assign(new Error(message), {
      invitationResponseStatus: status,
    });

    try {
      // The driver retries transient transaction conflicts. Do not send an HTTP
      // response inside this callback because it may run more than once.
      const result = await mongoose.connection.transaction(async (session) => {
        const invitation = await ChatInvitation.findById(invitationId).session(session);
        if (!invitation) {
          throw responseError(404, 'Invitation not found.');
        }
        if (!invitation.invitedUserId.equals(req.user.id) || invitation.invitedUserRole !== req.user.role) {
          throw responseError(403, 'Only the invited account can respond to this invitation.');
        }
        if (invitation.status !== 'pending') {
          throw responseError(409, 'This invitation has already been responded to.');
        }

        // Lock approval and membership documents against concurrent revocation.
        const { chat } = await chatAccess(invitation.chatId, req.user, 'approved', session);

        const respondedAt = new Date();
        const updatedInvitation = await ChatInvitation.findOneAndUpdate(
          {
            _id: invitation._id,
            invitedUserId: req.user.id,
            invitedUserRole: req.user.role,
            status: 'pending',
          },
          { $set: { status: action === 'accept' ? 'accepted' : 'declined', respondedAt } },
          { new: true, runValidators: true, session }
        );
        if (!updatedInvitation) {
          throw responseError(409, 'This invitation has already been responded to.');
        }

        if (action === 'accept') {
          await addMember(chat._id, { id: invitation.invitedUserId, role: invitation.invitedUserRole }, session, respondedAt);
        }
        await notify(
          { id: chat.ownerId, role: chat.ownerRole },
          action === 'accept' ? 'chat_invitation_accepted' : 'chat_invitation_declined',
          `An event group chat invitation was ${updatedInvitation.status}.`,
          session
        );

        return {
          id: updatedInvitation._id,
          chatId: updatedInvitation.chatId,
          status: updatedInvitation.status,
          respondedAt: updatedInvitation.respondedAt,
        };
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });

      return res.status(200).json({
        message: action === 'accept' ? 'Invitation accepted.' : 'Invitation declined.',
        invitation: result,
      });
    } catch (error) {
      if (error.chatStatus) {
        return res.status(error.chatStatus).json({ error: error.message });
      }
      if (error.invitationResponseStatus) {
        return res.status(error.invitationResponseStatus).json({ error: error.message });
      }

      // Standalone MongoDB cannot guarantee the required multi-document atomicity.
      // Fail without falling back to separate invitation and membership writes.
      if (error.code === 20 || error.code === 303) {
        return res.status(503).json({ error: 'Invitation responses require a MongoDB deployment with transaction support.' });
      }
      if (error.hasErrorLabel?.('UnknownTransactionCommitResult')) {
        return res.status(503).json({ error: 'Unable to confirm the invitation response. Check its status before retrying.' });
      }
      if (error.hasErrorLabel?.('TransientTransactionError') || error.code === 11000) {
        return res.status(409).json({ error: 'The invitation response conflicted with another request. Please retry.' });
      }

      console.error('Respond to event chat invitation error:', error.name, error.code || '');
      return res.status(500).json({ error: 'Unable to respond to the invitation.' });
    }
  }
);

// Keep the original endpoints above; mount the remaining protected chat APIs.
router.use(require('./eventChatMessageRoutes'));
router.use(require('./eventChatManagementRoutes'));

module.exports = router;
