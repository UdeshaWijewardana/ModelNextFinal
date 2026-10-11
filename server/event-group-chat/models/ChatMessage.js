
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventChat',
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    senderRole: {
      type: String,
      enum: ['model', 'photographer', 'agency', 'client'],
      required: true,
    },

    messageType: {
      type: String,
      enum: ['text', 'image'],
      required: true,
    },

    text: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },

    imageUrl: {
      type: String,
      default: null,
    },

    // Optional for compatibility with existing records; required by new send APIs.
    clientMessageId: { type: String, maxlength: 100 },
    image: {
      storageKey: { type: String, select: false },
      mimeType: { type: String },
      size: { type: Number },
      width: { type: Number },
      height: { type: Number },
      digest: { type: String, select: false },
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Retrieve messages in chronological order within a chat.
chatMessageSchema.index({
  chatId: 1,
  createdAt: 1,
  _id: 1,
});

// A retry key is scoped to the authenticated sender and chat. Existing messages
// without a retry key are excluded so this index remains backward compatible.
chatMessageSchema.index(
  { chatId: 1, senderId: 1, senderRole: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } }
);

// Validate message content based on message type.
chatMessageSchema.pre('validate', function () {
  if (this.messageType === 'text' && !this.text?.trim()) {
    this.invalidate('text', 'Text message cannot be empty.');
  }

  if (this.messageType === 'image' && !this.imageUrl) {
    this.invalidate('imageUrl', 'Image message requires an image.');
  }
});

module.exports = mongoose.model(
  'ChatMessage',
  chatMessageSchema
);
