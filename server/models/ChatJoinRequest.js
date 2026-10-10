
const mongoose = require('mongoose');

const chatJoinRequestSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventChat',
      required: true,
      index: true,
    },

    requestedById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    requestedByRole: {
      type: String,
      enum: ['model', 'photographer', 'agency', 'client'],
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },

    reviewedById: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate join requests for the same user and chat.
chatJoinRequestSchema.index(
  {
    chatId: 1,
    requestedById: 1,
    requestedByRole: 1,
  },
  { unique: true }
);

module.exports = mongoose.model(
  'ChatJoinRequest',
  chatJoinRequestSchema
);
