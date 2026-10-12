
const express = require('express');

const Event = require('../models/Event');
const ModelUser = require('../models/ModelUser');
const Photographer = require('../models/Photographer');

const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');

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
 * Returns approved models ranked by the existing AI matching
 * service against this specific event's requirements.
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
 * Returns approved photographers ranked using available
 * photographer profile information and this event's location.
 *
 * Note: this is a transparent compatibility heuristic, not
 * the model-specific prediction algorithm.
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
          'name location portfolio profileImage experienceYears'
        )
        .lean();

      const normalize = (value) =>
        String(value || '').trim().toLowerCase();

      const eventLocation = normalize(event.location);

      const matches = photographers.map((photographer) => {
        const photographerLocation = normalize(
          photographer.location
        );

        // Location compatibility: up to 40 points.
        let locationScore = 10;

        if (
          eventLocation &&
          photographerLocation &&
          (
            eventLocation === photographerLocation ||
            eventLocation.includes(photographerLocation) ||
            photographerLocation.includes(eventLocation)
          )
        ) {
          locationScore = 40;
        }

        // Experience: up to 30 points for 10+ years.
        const experienceYears = Math.max(
          0,
          Number(photographer.experienceYears) || 0
        );

        const experienceScore =
          Math.min(experienceYears, 10) * 3;

        // Portfolio provided: 20 points.
        const portfolioScore =
          photographer.portfolio &&
          photographer.portfolio.trim()
            ? 20
            : 0;

        // Profile image provided: 10 points.
        const imageScore =
          photographer.profileImage ? 10 : 0;

        const matchScore = Math.min(
          100,
          Math.round(
            locationScore +
            experienceScore +
            portfolioScore +
            imageScore
          )
        );

        let recommendation;

        if (matchScore >= 85) {
          recommendation = 'Excellent compatibility';
        } else if (matchScore >= 70) {
          recommendation = 'Good compatibility';
        } else if (matchScore >= 50) {
          recommendation = 'Moderate compatibility';
        } else {
          recommendation = 'Low compatibility';
        }

        return {
          id: photographer._id.toString(),
          fullName: photographer.name || 'Unnamed Photographer',
          location: photographer.location || '',
          profileImage: photographer.profileImage || '',
          portfolio: photographer.portfolio || '',
          experienceYears,
          matchScore,
          recommendation,
          compatible: matchScore >= 70,
          role: 'photographer',
        };
      });

      matches.sort(
        (a, b) => b.matchScore - a.matchScore
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
