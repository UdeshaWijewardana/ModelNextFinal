
const mongoose = require('mongoose');

const userRoles = [
  'model',
  'photographer',
  'agency',
  'client',
];

const chatInvitationSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventChat',
      required: true,
      index: true,
    },

    invitedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    invitedUserRole: {
      type: String,
      enum: userRoles,
      required: true,
    },

    invitedById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    invitedByRole: {
      type: String,
      enum: ['client', 'photographer', 'agency'],
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      required: true,
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate invitations for the same user in one chat.
chatInvitationSchema.index(
  {
    chatId: 1,
    invitedUserId: 1,
    invitedUserRole: 1,
  },
  { unique: true }
);

module.exports = mongoose.model(
  'ChatInvitation',
  chatInvitationSchema
);
