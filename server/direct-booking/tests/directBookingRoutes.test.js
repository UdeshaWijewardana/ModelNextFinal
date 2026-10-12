const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const auth = require('../../middleware/requireUser');
const database = require('../../middleware/requireDatabase');
const DirectBooking = require('../models/DirectBooking');
const PrivateMessage = require('../models/PrivateMessage');
const ModelUser = require('../../models/ModelUser');
const EventRequest = require('../../models/EventRequest');
const Notification = require('../../models/Notification');

const bookingId = '111111111111111111111111';
const modelId = '222222222222222222222222';
const otherModelId = '333333333333333333333333';
let booking;
let notifications;
let server;
let origin;

class FakeQuery {
  constructor(resolve) { this.resolve = resolve; }
  select() { return this; }
  populate() { return this; }
  lean() { return this; }
  sort() { return this; }
  limit() { return this; }
  then(resolve, reject) { return Promise.resolve(this.resolve()).then(resolve, reject); }
}

const original = {
  requireUser: auth.requireUser,
  requireDatabase: database.requireDatabase,
  findOne: DirectBooking.findOne,
  findById: DirectBooking.findById,
  findOneAndUpdate: DirectBooking.findOneAndUpdate,
  exists: DirectBooking.exists,
  privateMessagesFind: PrivateMessage.find,
  modelFindById: ModelUser.findById,
  eventRequestsFind: EventRequest.find,
  notificationsCreate: Notification.create,
};

auth.requireUser = (req, _res, next) => {
  const other = req.get('x-test-account') === 'other-model';
  req.user = { id: other ? otherModelId : modelId, role: 'model' };
  next();
};
database.requireDatabase = (_req, _res, next) => next();
DirectBooking.findOne = async (filter) => (
  String(booking._id) === String(filter._id)
  && String(booking.talentId) === String(filter.talentId)
  && booking.talentRole === filter.talentRole
  ? booking
  : null
);
DirectBooking.findById = (id) => new FakeQuery(() => String(booking._id) === String(id) ? booking : null);
DirectBooking.findOneAndUpdate = async (filter, update) => {
  if (String(booking._id) !== String(filter._id)
    || String(booking.talentId) !== String(filter.talentId)
    || booking.talentRole !== filter.talentRole
    || booking.status !== filter.status) return null;
  Object.assign(booking, update.$set);
  return booking;
};
DirectBooking.exists = async () => false;
PrivateMessage.find = () => new FakeQuery(() => []);
ModelUser.findById = () => new FakeQuery(() => ({ manualAvailability: [] }));
EventRequest.find = () => new FakeQuery(() => []);
Notification.create = async (record) => { notifications.push(record); };

const app = express();
app.use(express.json());
app.use('/api/direct-bookings', require('../directBookingRoutes'));
test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}/api/direct-bookings`;
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  auth.requireUser = original.requireUser;
  database.requireDatabase = original.requireDatabase;
  DirectBooking.findOne = original.findOne;
  DirectBooking.findById = original.findById;
  DirectBooking.findOneAndUpdate = original.findOneAndUpdate;
  DirectBooking.exists = original.exists;
  PrivateMessage.find = original.privateMessagesFind;
  ModelUser.findById = original.modelFindById;
  EventRequest.find = original.eventRequestsFind;
  Notification.create = original.notificationsCreate;
});

const request = async (path, { account, method = 'GET', body } = {}) => {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(account ? { 'x-test-account': account } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
};
const resetBooking = () => {
  booking = {
    _id: bookingId, requesterId: '444444444444444444444444', requesterRole: 'client',
    requesterName: 'Requester', talentId: modelId, talentRole: 'model', talentName: 'Model',
    jobType: 'Commercial Shoot', bookingDate: '2099-12-10', location: 'Colombo',
    description: 'Campaign shoot', status: 'pending',
  };
  notifications = [];
};

test('booking responses are talent-only, atomic, and reuse the authorized private chat', async () => {
  resetBooking();
  assert.equal((await request(`/${bookingId}/status`, {
    account: 'other-model', method: 'PATCH', body: { status: 'confirmed' },
  })).status, 404);
  assert.equal(booking.status, 'pending');

  const accepted = await request(`/${bookingId}/status`, { method: 'PATCH', body: { status: 'confirmed' } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.booking.status, 'confirmed');
  assert.equal(notifications[0].resourceId, bookingId);
  assert.equal(notifications[0].type, 'direct_booking_confirmed');
  assert.equal((await request(`/${bookingId}/messages`)).status, 200);
  assert.equal((await request(`/${bookingId}/status`, { method: 'PATCH', body: { status: 'declined' } })).status, 409);

  resetBooking();
  const responses = await Promise.all([
    request(`/${bookingId}/status`, { method: 'PATCH', body: { status: 'confirmed' } }),
    request(`/${bookingId}/status`, { method: 'PATCH', body: { status: 'declined' } }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);

  resetBooking();
  const declined = await request(`/${bookingId}/status`, { method: 'PATCH', body: { status: 'declined' } });
  assert.equal(declined.status, 200);
  assert.equal(booking.status, 'declined');
  assert.equal(notifications[0].type, 'direct_booking_declined');
  assert.equal((await request(`/${bookingId}/messages`)).status, 404);
});
