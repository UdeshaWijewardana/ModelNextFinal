const express = require('express');
const Event = require('../models/Event');
const EventRequest = require('../models/EventRequest');
const Notification = require('../models/Notification');
const { accountModels } = require('./authRoutes');
const { requireUser } = require('../middleware/requireUser');
const { requireDatabase } = require('../middleware/requireDatabase');

const router = express.Router();
const creatorRoles = new Set(['photographer', 'agency', 'client']);
const participantRoles = new Set(['model', 'photographer']);
const ownerName = (role, account) => role === 'model' ? account.fullName : (account.name || account.agencyName);

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

  // AI matching requirements
  requiredGender: event.requiredGender,
  minAge: event.minAge,
  maxAge: event.maxAge,
  minHeight: event.minHeight,
  maxHeight: event.maxHeight,
  requiredCategories: event.requiredCategories,
  requiredSkills: event.requiredSkills,

  status: event.status,
  ownerId: event.ownerId,
  ownerRole: event.ownerRole,
  createdAt: event.createdAt,
});

router.get('/', requireDatabase, async (_req, res) => {
  const events = await Event.find({ status: 'approved' }).sort({ startDate: 1 });
  return res.json({ events: events.map(safeEvent) });
});

router.get('/mine', requireUser, requireDatabase, async (req, res) => {
  const events = await Event.find({
    ownerId: req.user.id,
    ownerRole: req.user.role
  }).sort({ createdAt: -1 });

  const eventIds = events.map((event) => event._id);

  const requests = await EventRequest.find({
    eventId: { $in: eventIds },
    status: 'pending'
  }).populate('eventId', 'title');

  return res.json({
    events: events.map(safeEvent),
    requests: requests.map((request) => ({
      id: request._id,
      eventId: request.eventId?._id,
      eventTitle: request.eventId?.title,
      requesterId: request.requesterId,
      requesterRole: request.requesterRole,
      status: request.status
    }))
  });
});

router.get('/requests/mine', requireUser, requireDatabase, async (req, res) => {
  const requests = await EventRequest.find({
    requesterId: req.user.id,
    requesterRole: req.user.role
  }).populate('eventId', 'title');

  return res.json({
    requests: requests.map((request) => ({
      id: request._id,
      eventId: request.eventId?._id,
      eventTitle: request.eventId?.title,
      status: request.status
    }))
  });
});

router.post('/', requireUser, requireDatabase, async (req, res) => {
  if (!creatorRoles.has(req.user.role)) {
    return res.status(403).json({
      error: 'Only photographers, agencies, and clients can create events.'
    });
  }

  const owner = await accountModels[req.user.role].findById(req.user.id);

  if (!owner) {
    return res.status(401).json({
      error: 'Authentication is invalid or expired.'
    });
  }

  if (
    req.user.role !== 'client' &&
    owner.approvalStatus !== 'approved'
  ) {
    return res.status(403).json({
      error: 'Event creation is unavailable until administrator approval.'
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

    // AI matching requirements
    requiredGender,
    minAge,
    maxAge,
    minHeight,
    maxHeight,
    requiredCategories,
    requiredSkills
  } = req.body || {};

  if (
    ![title, eventType, startDate, location, description].every(
      (value) => typeof value === 'string' && value.trim()
    )
  ) {
    return res.status(400).json({
      error: 'Title, type, start date, location, and description are required.'
    });
  }

  const event = await Event.create({
    title,
    eventType,
    startDate,
    endDate: endDate || undefined,
    location,
    description,
    image,

    // AI matching requirements
    requiredGender: requiredGender || undefined,

    minAge:
      minAge !== undefined && minAge !== ''
        ? Number(minAge)
        : undefined,

    maxAge:
      maxAge !== undefined && maxAge !== ''
        ? Number(maxAge)
        : undefined,

    minHeight:
      minHeight !== undefined && minHeight !== ''
        ? Number(minHeight)
        : undefined,

    maxHeight:
      maxHeight !== undefined && maxHeight !== ''
        ? Number(maxHeight)
        : undefined,

    requiredCategories:
      Array.isArray(requiredCategories)
        ? requiredCategories
        : [],

    requiredSkills:
      Array.isArray(requiredSkills)
        ? requiredSkills
        : [],

    organizerName: ownerName(req.user.role, owner),
    ownerId: owner._id,
    ownerRole: req.user.role
  });

  return res.status(201).json({
    event: safeEvent(event)
  });
});

router.post('/:id/requests', requireUser, requireDatabase, async (req, res) => {
  if (!participantRoles.has(req.user.role)) {
    return res.status(403).json({
      error: 'Only models and photographers can request to join events.'
    });
  }

  const event = await Event.findOne({
    _id: req.params.id,
    status: 'approved'
  });

  if (!event) {
    return res.status(404).json({
      error: 'Approved event was not found.'
    });
  }

  try {
    const request = await EventRequest.create({
      eventId: event._id,
      requesterId: req.user.id,
      requesterRole: req.user.role
    });

    await Notification.create({
      recipientId: event.ownerId,
      recipientRole: event.ownerRole,
      type: 'event_request',
      message: `A ${req.user.role} requested to join ${event.title}.`
    });

    return res.status(201).json({
      request: {
        id: request._id,
        eventId: request.eventId,
        status: request.status
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'You already requested to join this event.'
      });
    }

    throw error;
  }
});

router.patch('/requests/:id', requireUser, requireDatabase, async (req, res) => {
  const status = req.body?.status;

  if (!['confirmed', 'declined'].includes(status)) {
    return res.status(400).json({
      error: 'Status must be confirmed or declined.'
    });
  }

  const request = await EventRequest
    .findById(req.params.id)
    .populate('eventId');

  if (!request || !request.eventId) {
    return res.status(404).json({
      error: 'Event request was not found.'
    });
  }

  if (
    request.eventId.ownerId.toString() !== req.user.id ||
    request.eventId.ownerRole !== req.user.role
  ) {
    return res.status(403).json({
      error: 'You cannot review this event request.'
    });
  }

  request.status = status;
  await request.save();

  await Notification.create({
    recipientId: request.requesterId,
    recipientRole: request.requesterRole,
    type: 'event_request_reviewed',
    message: `Your request to join ${request.eventId.title} was ${status}.`
  });

  return res.json({
    request: {
      id: request._id,
      status: request.status
    }
  });
});

router.delete('/:id', requireUser, requireDatabase, async (req, res) => {
  const event = await Event.findOneAndDelete({
    _id: req.params.id,
    ownerId: req.user.id,
    ownerRole: req.user.role
  });

  if (!event) {
    return res.status(404).json({
      error: 'Event was not found.'
    });
  }

  await EventRequest.deleteMany({
    eventId: event._id
  });

  return res.status(204).end();
});

module.exports = {
  router,
  safeEvent
};