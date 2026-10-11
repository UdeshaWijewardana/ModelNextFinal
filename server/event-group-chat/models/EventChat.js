
const mongoose = require('mongoose');

const chatMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    role: {
      type: String,
      enum: ['model', 'photographer', 'agency', 'client'],
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const eventChatSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      unique: true,
      index: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    ownerRole: {
      type: String,
      enum: ['client', 'photographer', 'agency'],
      required: true,
    },

    members: {
      type: [chatMemberSchema],
      default: [],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EventChat', eventChatSchema);
