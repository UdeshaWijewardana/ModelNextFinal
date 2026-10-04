const express = require('express');
const Event = require('../models/Event');
const ModelUser = require('../models/ModelUser');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');
const {
  rankModelsForEvent
} = require('../services/aiMatchingService');

const router = express.Router();

/**
 * GET /api/matching/events/:eventId/models
 *
 * Returns models ranked according to their compatibility
 * with the selected event.
 */
router.get(
  '/events/:eventId/models',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.eventId);

      if (!event) {
        return res.status(404).json({
          error: 'Event was not found.'
        });
      }

      const models = await ModelUser.find({
        approvalStatus: 'approved'
      }).select(
        'fullName location gender categories skills birthdate height weight waist hip profileImage'
      );

      const rankedModels = await rankModelsForEvent(
        models.map((model) => model.toObject()),
        event.toObject()
      );

      return res.json({
        event: {
          id: event._id,
          title: event.title,
          eventType: event.eventType,
          location: event.location
        },
        matches: rankedModels
      });
    } catch (error) {
      console.error('AI matching error:', error);

      return res.status(500).json({
        error: 'Failed to generate model matches.'
      });
    }
  }
);

module.exports = router;