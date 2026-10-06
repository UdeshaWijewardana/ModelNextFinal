const mongoose = require('mongoose');

const eventRequestSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },

    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    requesterRole: {
      type: String,
      enum: ['model', 'photographer'],
      required: true,
    },

    // participation:
    // model/photographer asks to join an event
    //
    // booking:
    // client asks a model to work on an event
    requestType: {
      type: String,
      enum: ['participation', 'booking'],
      default: 'participation',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'declined'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Allows one participation request AND one booking
// request for the same event/model combination.
eventRequestSchema.index(
  {
    eventId: 1,
    requesterId: 1,
    requestType: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  'EventRequest',
  eventRequestSchema
);