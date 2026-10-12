const express = require('express');
const mongoose = require('mongoose');

const Event = require('../models/Event');
const EventRequest = require('../models/EventRequest');
const ModelUser = require('../models/ModelUser');
const Notification = require('../models/Notification');

const { accountModels } = require('./authRoutes');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');
const Photographer = require('../models/Photographer');

const router = express.Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

// Private details include pending/rejected events, but only for their owner.
router.get('/mine/:id', requireUser, requireDatabase, async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ error: 'Invalid event ID.' });
  }
  try {
    const event = await Event.findOne({
      _id: req.params.id, ownerId: req.user.id, ownerRole: req.user.role,
    });
    if (!event) return res.status(404).json({ error: 'Event was not found.' });
    return res.json({ event: { ...safeEvent(event), rejectionReason: event.rejectionReason } });
  } catch (_error) {
    return res.status(500).json({ error: 'Unable to load your event.' });
  }
});


// =====================================================
// ROLE CONFIGURATION
// =====================================================

const creatorRoles = new Set([
  'photographer',
  'agency',
  'client',
]);

const participantRoles = new Set([
  'model',
  'photographer',
]);

const validEventDates = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end >= start;
};

router.param('id', (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ error: 'Invalid event ID.' });
  next();
});


// =====================================================
// HELPERS
// =====================================================

const ownerName = (role, account) => {
  if (role === 'model') {
    return account.fullName;
  }

  return account.name || account.agencyName;
};


const safeEvent = (event) => ({
  id: event._id,
  title: event.title,
  eventType: event.eventType,

  startDate: event.startDate,
  endDate: event.endDate,

  location: event.location,

  organizerName: event.organizerName,
  description: event.description,
  image: event.image,

  requiredGender: event.requiredGender,

  minAge: event.minAge,
  maxAge: event.maxAge,

  minHeight: event.minHeight,
  maxHeight: event.maxHeight,

  requiredCategories:
    event.requiredCategories || [],

  requiredSkills:
    event.requiredSkills || [],

  status: event.status,

  ownerId: event.ownerId,
  ownerRole: event.ownerRole,

  createdAt: event.createdAt,
});


// =====================================================
// GET APPROVED EVENTS
// GET /api/events
// =====================================================

router.get(
  '/',
  requireDatabase,
  async (_req, res) => {
    try {
      const events = await Event.find({
        status: 'approved',
      }).sort({
        startDate: 1,
      });

      return res.json({
        events: events.map(safeEvent),
      });
    } catch (error) {
      console.error(
        'Get approved events error:',
        error
      );

      return res.status(500).json({
        error: 'Unable to load events.',
      });
    }
  }
);


// =====================================================
// GET CLIENT'S / OWNER'S EVENTS
// GET /api/events/mine
// =====================================================

router.get(
  '/mine',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const events = await Event.find({
        ownerId: req.user.id,
        ownerRole: req.user.role,
      }).sort({
        createdAt: -1,
      });

      const eventIds = events.map(
        (event) => event._id
      );

      // Only participation requests appear in the
      // client's Participation Requests section.
      //
      // A booking request is different:
      // client -> model -> model responds.
      const requests = await EventRequest.find({
        eventId: {
          $in: eventIds,
        },
        status: 'pending',
        requestType: 'participation',
      }).populate(
        'eventId',
        'title'
      );

      return res.json({
        events: events.map(safeEvent),

        requests: requests.map(
          (request) => ({
            id: request._id,

            eventId:
              request.eventId?._id,

            eventTitle:
              request.eventId?.title,

            requesterId:
              request.requesterId,

            requesterRole:
              request.requesterRole,

            requestType:
              request.requestType,

            status:
              request.status,
          })
        ),
      });
    } catch (error) {
      console.error(
        'Get my events error:',
        error
      );

      return res.status(500).json({
        error: 'Unable to load your events.',
      });
    }
  }
);


// =====================================================
// GET ALL BOOKINGS / REQUESTS FOR CLIENT
// GET /api/events/bookings/mine
//
// Returns:
// - pending
// - confirmed
// - declined
//
// IMPORTANT:
// This returns both booking and participation records
// belonging to the client's events, but includes
// requestType so the frontend can display them correctly.
// =====================================================

/**
 * GET /api/events/talent/bookings/mine
 * Get event booking requests received by the logged-in photographer/model.
 */
router.get(
  '/talent/bookings/mine',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      if (!['photographer', 'model'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Only photographers and models can view received bookings.',
        });
      }

      const requests = await EventRequest.find({
        requesterId: req.user.id,
        requesterRole: req.user.role,
        requestType: 'booking',
      })
        .populate(
          'eventId',
          'title eventType startDate endDate location ownerId ownerRole'
        )
        .sort({ createdAt: -1 });

      const bookings = requests.map((request) => ({
        id: request._id,
        eventId: request.eventId?._id || request.eventId,
        eventTitle: request.eventId?.title || 'Event',
        eventType: request.eventId?.eventType || 'Event',
        startDate: request.eventId?.startDate || null,
        endDate: request.eventId?.endDate || null,
        location: request.eventId?.location || '',
        status: request.status,
        requestType: request.requestType || 'booking',
        createdAt: request.createdAt,
      }));

      return res.json({ bookings });
    } catch (error) {
      console.error('Get received event bookings error:', error);

      return res.status(500).json({
        error: 'Unable to load event booking requests.',
      });
    }
  }
);

router.get(
  '/bookings/mine',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const events = await Event.find({
        ownerId: req.user.id,
        ownerRole: req.user.role,
      }).select(
        '_id title eventType startDate endDate location'
      );

      const eventIds = events.map(
        (event) => event._id
      );

      const eventMap = new Map(
        events.map(
          (event) => [
            event._id.toString(),
            event,
          ]
        )
      );

      // Do not filter by status here.
      // The dashboard needs pending, confirmed
      // and declined records.
      const requests =
        await EventRequest.find({
          eventId: {
            $in: eventIds,
          },
        }).sort({
          createdAt: -1,
        });

      const bookings =
        requests.map(
          (request) => {
            const event =
              eventMap.get(
                request.eventId.toString()
              );

            return {
              id: request._id,

              eventId:
                request.eventId,

              eventTitle:
                event?.title ||
                'Project',

              eventType:
                event?.eventType ||
                'Event',

              startDate:
                event?.startDate ||
                null,

              endDate:
                event?.endDate ||
                null,

              location:
                event?.location ||
                '',

              requesterId:
                request.requesterId,

              requesterRole:
                request.requesterRole,

              // IMPORTANT:
              // Allows the frontend to distinguish:
              // booking vs participation.
              requestType:
                request.requestType ||
                'participation',

              status:
                request.status,

              createdAt:
                request.createdAt,
            };
          }
        );

      return res.json({
        bookings,
      });
    } catch (error) {
      console.error(
        'Get client bookings error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to load your bookings.',
      });
    }
  }
);


// =====================================================
// GET REQUESTS MADE BY CURRENT USER
// GET /api/events/requests/mine
// =====================================================


router.get(
  '/requests/mine',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const requests = await EventRequest.find({
        requesterId: req.user.id,
        requesterRole: req.user.role,
      })
        .populate('eventId', 'title eventType location')
        .sort({ createdAt: -1 });

      return res.json({
        requests: requests.map((request) => ({
          id: request._id,
          eventId: request.eventId?._id || null,
          eventTitle: request.eventId?.title || 'Untitled event',
          eventType: request.eventId?.eventType || '',
          eventLocation: request.eventId?.location || '',
          requesterRole: request.requesterRole,
          requestType: request.requestType || 'participation',
          status: request.status,
        })),
      });
    } catch (error) {
      console.error('Get my requests error:', error);

      return res.status(500).json({
        error: 'Unable to load your requests.',
      });
    }
  }
);



// =====================================================
// CREATE EVENT
// POST /api/events
// =====================================================

router.post(
  '/',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      if (
        !creatorRoles.has(
          req.user.role
        )
      ) {
        return res.status(403).json({
          error:
            'Only photographers, agencies, and clients can create events.',
        });
      }

      const owner =
        await accountModels[
          req.user.role
        ].findById(req.user.id);

      if (!owner) {
        return res.status(401).json({
          error:
            'Authentication is invalid or expired.',
        });
      }

      // Photographers and agencies must be approved.
      // Clients can create events directly.
      if (
        req.user.role !== 'client' &&
        owner.approvalStatus !== 'approved'
      ) {
        return res.status(403).json({
          error:
            'Event creation is unavailable until administrator approval.',
        });
      }

      const {
        title,
        eventType,
        startDate,
        endDate,
        location,
        description,
        image,

        requiredGender,

        minAge,
        maxAge,

        minHeight,
        maxHeight,

        requiredCategories,
        requiredSkills,
      } = req.body || {};

      if (
        [
          title,
          eventType,
          startDate,
          location,
          description,
        ].some(
          (value) =>
            typeof value !== 'string' ||
            !value.trim()
        )
      ) {
        return res.status(400).json({
          error:
            'Title, type, start date, location, and description are required.',
        });
      }

      if (!validEventDates(startDate, endDate)) {
        return res.status(400).json({ error: 'Provide valid event dates with the end on or after the start.' });
      }

      const numericRequirement = (
        value,
        field
      ) => {
        if (
          value === undefined ||
          value === ''
        ) {
          return undefined;
        }

        const number = Number(value);

        if (
          !Number.isFinite(number) ||
          number < 0
        ) {
          throw new Error(
            `${field} must be a non-negative number.`
          );
        }

        return number;
      };

      let requirements;

      try {
        requirements = {
          requiredGender:
            typeof requiredGender ===
              'string' &&
            requiredGender.trim()
              ? requiredGender.trim()
              : undefined,

          minAge:
            numericRequirement(
              minAge,
              'Minimum age'
            ),

          maxAge:
            numericRequirement(
              maxAge,
              'Maximum age'
            ),

          minHeight:
            numericRequirement(
              minHeight,
              'Minimum height'
            ),

          maxHeight:
            numericRequirement(
              maxHeight,
              'Maximum height'
            ),

          requiredCategories:
            Array.isArray(
              requiredCategories
            )
              ? requiredCategories
                  .filter(
                    (item) =>
                      typeof item ===
                        'string' &&
                      item.trim()
                  )
                  .map((item) =>
                    item.trim()
                  )
              : [],

          requiredSkills:
            Array.isArray(
              requiredSkills
            )
              ? requiredSkills
                  .filter(
                    (item) =>
                      typeof item ===
                        'string' &&
                      item.trim()
                  )
                  .map((item) =>
                    item.trim()
                  )
              : [],
        };
      } catch (error) {
        return res.status(400).json({
          error: error.message,
        });
      }

      if (
        requirements.minAge !==
          undefined &&
        requirements.maxAge !==
          undefined &&
        requirements.minAge >
          requirements.maxAge
      ) {
        return res.status(400).json({
          error:
            'Minimum age cannot exceed maximum age.',
        });
      }

      if (
        requirements.minHeight !==
          undefined &&
        requirements.maxHeight !==
          undefined &&
        requirements.minHeight >
          requirements.maxHeight
      ) {
        return res.status(400).json({
          error:
            'Minimum height cannot exceed maximum height.',
        });
      }

      const event =
        await Event.create({
          title:
            title.trim(),

          eventType:
            eventType.trim(),

          startDate,

          endDate:
            endDate || undefined,

          location:
            location.trim(),

          description:
            description.trim(),

          image,

          ...requirements,

          organizerName:
            ownerName(
              req.user.role,
              owner
            ),

          ownerId:
            owner._id,

          ownerRole:
            req.user.role,
        });

      return res.status(201).json({
        event: safeEvent(event),
      });
    } catch (error) {
      console.error(
        'Create event error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to create the event.',
      });
    }
  }
);


// =====================================================
// EDIT EVENT
// PATCH /api/events/:id
// =====================================================

router.patch(
  '/:id',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const event =
        await Event.findOne({
          _id: req.params.id,
          ownerId: req.user.id,
          ownerRole: req.user.role,
        });

      if (!event) {
        return res.status(404).json({
          error:
            'Event was not found or you do not have permission to edit it.',
        });
      }

      const {
        title,
        eventType,
        startDate,
        endDate,
        location,
        description,
        image,

        requiredGender,

        minAge,
        maxAge,

        minHeight,
        maxHeight,

        requiredCategories,
        requiredSkills,
      } = req.body || {};

      if (
        [
          title,
          eventType,
          startDate,
          location,
          description,
        ].some(
          (value) =>
            typeof value !== 'string' ||
            !value.trim()
        )
      ) {
        return res.status(400).json({
          error:
            'Title, type, start date, location, and description are required.',
        });
      }

      if (!validEventDates(startDate, endDate)) {
        return res.status(400).json({ error: 'Provide valid event dates with the end on or after the start.' });
      }

      const numberValue = (
        value
      ) => {
        if (
          value === undefined ||
          value === ''
        ) {
          return undefined;
        }

        const number = Number(value);

        if (
          !Number.isFinite(number) ||
          number < 0
        ) {
          return null;
        }

        return number;
      };

      const newMinAge =
        numberValue(minAge);

      const newMaxAge =
        numberValue(maxAge);

      const newMinHeight =
        numberValue(minHeight);

      const newMaxHeight =
        numberValue(maxHeight);

      if (
        newMinAge === null ||
        newMaxAge === null ||
        newMinHeight === null ||
        newMaxHeight === null
      ) {
        return res.status(400).json({
          error:
            'Age and height values must be non-negative numbers.',
        });
      }

      if (
        newMinAge !== undefined &&
        newMaxAge !== undefined &&
        newMinAge > newMaxAge
      ) {
        return res.status(400).json({
          error:
            'Minimum age cannot exceed maximum age.',
        });
      }

      if (
        newMinHeight !== undefined &&
        newMaxHeight !== undefined &&
        newMinHeight >
          newMaxHeight
      ) {
        return res.status(400).json({
          error:
            'Minimum height cannot exceed maximum height.',
        });
      }

      event.title =
        title.trim();

      event.eventType =
        eventType.trim();

      event.startDate =
        startDate;

      event.endDate =
        endDate || undefined;

      event.location =
        location.trim();

      event.description =
        description.trim();

      if (image !== undefined) {
        event.image = image;
      }

      event.requiredGender =
        typeof requiredGender ===
          'string' &&
        requiredGender.trim()
          ? requiredGender.trim()
          : undefined;

      event.minAge =
        newMinAge;

      event.maxAge =
        newMaxAge;

      event.minHeight =
        newMinHeight;

      event.maxHeight =
        newMaxHeight;

      event.requiredCategories =
        Array.isArray(
          requiredCategories
        )
          ? requiredCategories
              .filter(
                (item) =>
                  typeof item ===
                    'string' &&
                  item.trim()
              )
              .map((item) =>
                item.trim()
              )
          : [];

      event.requiredSkills =
        Array.isArray(
          requiredSkills
        )
          ? requiredSkills
              .filter(
                (item) =>
                  typeof item ===
                    'string' &&
                  item.trim()
              )
              .map((item) =>
                item.trim()
              )
          : [];

      await event.save();

      return res.json({
        event: safeEvent(event),
      });
    } catch (error) {
      console.error(
        'Edit event error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to update the event.',
      });
    }
  }
);


// =====================================================
// BOOK MODEL FOR EVENT
// POST /api/events/:id/bookings
//
// Used by:
// 1. AI Match booking
// 2. Normal model profile booking
//
// FLOW:
//
// Client
//   ↓
// Booking request
//   ↓
// Model
//   ↓
// Accept / Decline
//
// The client does NOT approve its own booking.
// =====================================================


router.post(
  '/:id/bookings',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({
          error: 'Only clients can create booking requests.',
        });
      }

      const { talentId, talentRole, modelId } = req.body || {};

      // Backward compatibility with existing model bookings.
      const selectedTalentId = talentId || modelId;
      const selectedTalentRole = talentRole || 'model';

      if (!selectedTalentId) {
        return res.status(400).json({
          error: 'Talent ID is required.',
        });
      }

      if (!['model', 'photographer'].includes(selectedTalentRole)) {
        return res.status(400).json({
          error: 'Talent role must be model or photographer.',
        });
      }

      const event = await Event.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        ownerRole: 'client',
      });

      if (!event) {
        return res.status(404).json({
          error: 'Event was not found.',
        });
      }

      if (event.status !== 'approved') {
        return res.status(400).json({
          error: 'This event must be approved before you can book talent.',
        });
      }

      const TalentModel =
        selectedTalentRole === 'photographer'
          ? Photographer
          : ModelUser;

      const talent = await TalentModel.findOne({
        _id: selectedTalentId,
        approvalStatus: 'approved',
      });

      if (!talent) {
        return res.status(404).json({
          error: `Approved ${selectedTalentRole} was not found.`,
        });
      }

      const talentName =
        selectedTalentRole === 'model'
          ? talent.fullName
          : talent.name;

      let request = await EventRequest.findOne({
        eventId: event._id,
        requesterId: talent._id,
        requesterRole: selectedTalentRole,
        requestType: 'booking',
      });

      if (request && request.status === 'confirmed') {
        return res.status(409).json({
          error: 'This talent is already booked for this event.',
        });
      }

      if (request && request.status === 'pending') {
        return res.status(409).json({
          error: 'A booking request for this talent is already pending.',
        });
      }

      if (request) {
        request.status = 'pending';
        await request.save();
      } else {
        request = await EventRequest.create({
          eventId: event._id,
          requesterId: talent._id,
          requesterRole: selectedTalentRole,
          requestType: 'booking',
          status: 'pending',
        });
      }

      await Notification.create({
        recipientId: talent._id,
        recipientRole: selectedTalentRole,
        type: 'event_request',
        message: `You have received a booking request for ${event.title}.`,
      });

      return res.status(201).json({
        message: 'Booking request sent successfully.',
        request: {
          id: request._id,
          eventId: event._id,
          eventTitle: event.title,
          talentId: talent._id,
          talentName,
          talentRole: selectedTalentRole,
          requestType: 'booking',
          status: request.status,
        },
      });
    } catch (error) {
      console.error('Talent booking error:', error);

      return res.status(500).json({
        error: 'Unable to send the booking request.',
      });
    }
  }
);



// =====================================================
// CREATE PARTICIPATION REQUEST
// POST /api/events/:id/requests
//
// Used when a model/photographer
// wants to join an event.
//
// FLOW:
//
// Model / Photographer
//   ↓
// Participation request
//   ↓
// Event owner
//   ↓
// Approve / Decline
// =====================================================

router.post(
  '/:id/requests',
  requireUser,
  requireDatabase,
  async (req, res) => {
    if (
      !participantRoles.has(
        req.user.role
      )
    ) {
      return res.status(403).json({
        error:
          'Only models and photographers can request to join events.',
      });
    }

    const event =
      await Event.findOne({
        _id: req.params.id,
        status: 'approved',
      });

    if (!event) {
      return res.status(404).json({
        error:
          'Approved event was not found.',
      });
    }

    try {
      const request =
        await EventRequest.create({
          eventId:
            event._id,

          requesterId:
            req.user.id,

          requesterRole:
            req.user.role,

          requestType:
            'participation',
        });

      await Notification.create({
        recipientId:
          event.ownerId,

        recipientRole:
          event.ownerRole,

        type:
          'event_request',

        message:
          `A ${req.user.role} requested to join ${event.title}.`,
      });

      return res.status(201).json({
        request: {
          id:
            request._id,

          eventId:
            request.eventId,

          status:
            request.status,

          requestType:
            'participation',
        },
      });
    } catch (error) {
      if (
        error.code ===
        11000
      ) {
        return res.status(409).json({
          error:
            'You already requested to join this event.',
        });
      }

      console.error(
        'Create participation request error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to create the request.',
      });
    }
  }
);


// =====================================================
// REVIEW PARTICIPATION REQUEST
// PATCH /api/events/requests/:id
//
// Event owner can confirm or decline
// a model/photographer PARTICIPATION request.
//
// IMPORTANT:
// This endpoint cannot approve a booking.
// Booking requests are responded to by the model.
// =====================================================

router.patch(
  '/requests/:id',
  requireUser,
  requireDatabase,
  async (req, res) => {
    const status =
      req.body?.status;

    if (
      ![
        'confirmed',
        'declined',
      ].includes(status)
    ) {
      return res.status(400).json({
        error:
          'Status must be confirmed or declined.',
      });
    }

    const request =
      await EventRequest.findById(
        req.params.id
      ).populate(
        'eventId'
      );

    if (
      !request ||
      !request.eventId
    ) {
      return res.status(404).json({
        error:
          'Event request was not found.',
      });
    }

    // Only the event owner can review.
    if (
      request.eventId.ownerId.toString() !==
        req.user.id ||
      request.eventId.ownerRole !==
        req.user.role
    ) {
      return res.status(403).json({
        error:
          'You cannot review this event request.',
      });
    }

    // IMPORTANT:
    // This endpoint is ONLY for participation requests.
    //
    // If the request is a booking, the model must
    // accept or decline it from the model dashboard.
    if (
      (request.requestType ||
        'participation') !==
      'participation'
    ) {
      return res.status(403).json({
        error:
          'Client booking requests must be responded to by the model.',
      });
    }

    request.status =
      status;

    await request.save();

    // Notify the requester.
    await Notification.create({
      recipientId:
        request.requesterId,

      recipientRole:
        request.requesterRole,

      type:
        'event_request_reviewed',

      message:
        `Your request to join ${request.eventId.title} was ${status}.`,
    });

    return res.json({
      request: {
        id:
          request._id,

        status:
          request.status,

        requestType:
          request.requestType ||
          'participation',
      },
    });
  }
);


// =====================================================
// RESPOND TO MODEL BOOKING REQUEST
// PATCH /api/events/bookings/:id/respond
//
// Client sends booking request.
// Model accepts or declines.
//
// ONLY THE MODEL WHO RECEIVED THE REQUEST
// CAN RESPOND.
// =====================================================


router.patch(
  '/bookings/:id/respond',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      // Both models and photographers can respond.
      if (!['model', 'photographer'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Only models and photographers can respond to booking requests.',
        });
      }

      const status = req.body?.status;

      if (!['confirmed', 'declined'].includes(status)) {
        return res.status(400).json({
          error: 'Status must be confirmed or declined.',
        });
      }

      // Only allow the logged-in talent to respond to their own booking.
      const request = await EventRequest.findOne({
        _id: req.params.id,
        requesterId: req.user.id,
        requesterRole: req.user.role,
        requestType: 'booking',
      }).populate('eventId');

      if (!request || !request.eventId) {
        return res.status(404).json({
          error: 'Booking request was not found.',
        });
      }

      if (request.status !== 'pending') {
        return res.status(409).json({
          error: `This booking request has already been ${request.status}.`,
        });
      }

      request.status = status;
      await request.save();

      await Notification.create({
        recipientId: request.eventId.ownerId,
        recipientRole: request.eventId.ownerRole,
        type: 'booking_request_reviewed',
        message: `Your booking request for ${request.eventId.title} was ${status} by the ${req.user.role}.`,
      });

      return res.json({
        message: `Booking request ${status} successfully.`,
        request: {
          id: request._id,
          eventId: request.eventId._id,
          eventTitle: request.eventId.title,
          status: request.status,
          requestType: 'booking',
          talentRole: req.user.role,
        },
      });
    } catch (error) {
      console.error('Booking response error:', error);

      return res.status(500).json({
        error: 'Unable to respond to the booking request.',
      });
    }
  }
);



// =====================================================
// DELETE EVENT
// DELETE /api/events/:id
// =====================================================

router.delete(
  '/:id',
  requireUser,
  requireDatabase,
  async (req, res) => {
    try {
      const event =
        await Event.findOne({
          _id: req.params.id,
          ownerId: req.user.id,
          ownerRole: req.user.role,
        });

      if (!event) {
        return res.status(404).json({
          error:
            'Event was not found.',
        });
      }

      // Do not permanently delete events that
      // already have confirmed BOOKINGS.
      //
      // Participation approvals are not counted here.
      const confirmedBookings =
        await EventRequest.countDocuments({
          eventId:
            event._id,

          requestType:
            'booking',

          status:
            'confirmed',
        });

      if (
        confirmedBookings > 0
      ) {
        return res.status(409).json({
          error:
            'This event has confirmed bookings. Cancel the event instead of permanently deleting it.',
        });
      }

      await EventRequest.deleteMany({
        eventId:
          event._id,
      });

      await event.deleteOne();

      return res.status(204).end();
    } catch (error) {
      console.error(
        'Delete event error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to delete the event.',
      });
    }
  }
);


// =====================================================
// EXPORT
// =====================================================

module.exports = {
  router,
  safeEvent,
};
