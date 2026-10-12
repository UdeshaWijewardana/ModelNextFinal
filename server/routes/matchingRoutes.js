
const express = require('express');

const Event = require('../models/Event');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');

const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');

const {
  rankPhotographersForEvent,
} = require('../services/photographerMatchingService');

const {
  rankModelsForEvent,
} = require('../services/aiMatchingService');

const router = express.Router();

/**
 * Verify that the logged-in user owns the requested event.
 */
const getOwnedEvent = async (eventId, user) => {
  const event = await Event.findById(eventId);

  if (!event) {
    return {
      error: 'Event was not found.',
      status: 404,
    };
  }

  if (
    !event.ownerId ||
    event.ownerId.toString() !== user.id ||
    event.ownerRole !== user.role
  ) {
    return {
      error: 'You cannot view recommendations for this event.',
      status: 403,
    };
  }

  return { event };
};

/**
 * GET /api/matching/events/:eventId/models
 *
 * Returns approved models ranked by the existing AI matching service.
 */
router.get(
  '/events/:eventId/models',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const result = await getOwnedEvent(
        req.params.eventId,
        req.user
      );

      if (result.error) {
        return res.status(result.status).json({
          error: result.error,
        });
      }

      const { event } = result;

      const models = await ModelUser.find({
        approvalStatus: 'approved',
      })
        .select(
          'fullName location gender categories skills birthdate height weight waist hip profileImage'
        )
        .lean();

      const matches = await rankModelsForEvent(
        models,
        event.toObject()
      );

      return res.json({
        event: {
          id: event._id,
          title: event.title,
          eventType: event.eventType,
          location: event.location,
        },
        matches: matches.map((match) => ({
          ...match,
          role: 'model',
        })),
      });
    } catch (error) {
      console.error('AI model matching error:', error);

      return res.status(500).json({
        error: 'Failed to generate model recommendations.',
      });
    }
  }
);

/**
 * GET /api/matching/events/:eventId/photographers
 *
 * Returns approved photographers ranked by the dedicated
 * photographer matching service.
 */
router.get(
  '/events/:eventId/photographers',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const result = await getOwnedEvent(
        req.params.eventId,
        req.user
      );

      if (result.error) {
        return res.status(result.status).json({
          error: result.error,
        });
      }

      const { event } = result;

      const photographers = await Photographer.find({
        approvalStatus: 'approved',
      })
        .select(
          'name location portfolio profileImage experienceYears photographyStyles skills'
        )
        .lean();

      const matches = rankPhotographersForEvent(
        photographers,
        event.toObject()
      );

      return res.json({
        event: {
          id: event._id,
          title: event.title,
          eventType: event.eventType,
          location: event.location,
        },
        matches,
      });
    } catch (error) {
      console.error(
        'AI photographer matching error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to generate photographer recommendations.',
      });
    }
  }
);

module.exports = router;
