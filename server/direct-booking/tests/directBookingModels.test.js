const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const DirectBooking = require('../models/DirectBooking');
const PrivateMessage = require('../models/PrivateMessage');
const { isParty } = require('../bookingAccess');

const id = () => new mongoose.Types.ObjectId();
const validBooking = () => ({ requesterId: id(), requesterRole: 'client', requesterName: 'Requester', talentId: id(), talentRole: 'model', talentName: 'Talent', jobType: 'Commercial Shoot', bookingDate: '2026-12-10', location: 'Colombo', description: 'Campaign shoot' });

test('direct booking accepts the simple pending-confirmed-declined lifecycle', () => {
  const booking = new DirectBooking(validBooking());
  assert.equal(booking.status, 'pending');
  for (const status of ['pending', 'confirmed', 'declined']) { booking.status = status; assert.equal(booking.validateSync(), undefined); }
  booking.status = 'cancelled'; assert.match(booking.validateSync().message, /status/);
});

test('booking schema restricts roles, talent types, job types and date format', () => {
  const booking = new DirectBooking({ ...validBooking(), requesterRole: 'model', talentRole: 'agency', jobType: 'Wedding', bookingDate: '10/12/2026' });
  const error = booking.validateSync();
  for (const field of ['requesterRole', 'talentRole', 'jobType', 'bookingDate']) assert.ok(error.errors[field]);
});

test('confirmed dates have a database-enforced unique talent/date index', () => {
  const index = DirectBooking.schema.indexes().find(([keys, options]) => keys.talentId === 1 && keys.bookingDate === 1 && options.unique);
  assert.ok(index); assert.deepEqual(index[1].partialFilterExpression, { status: 'confirmed' });
});

test('only the exact requester or talent account is a booking party', () => {
  const booking = validBooking();
  assert.equal(isParty(booking, { id: booking.requesterId, role: 'client' }), true);
  assert.equal(isParty(booking, { id: booking.talentId, role: 'model' }), true);
  assert.equal(isParty(booking, { id: booking.requesterId, role: 'agency' }), false);
  assert.equal(isParty(booking, { id: id(), role: 'client' }), false);
});

test('private messages require bounded text and supported sender identity', () => {
  const message = new PrivateMessage({ bookingId: id(), senderId: id(), senderRole: 'model', senderName: 'Talent', text: 'Shoot details' });
  assert.equal(message.validateSync(), undefined);
  message.text = 'x'.repeat(2001); assert.ok(message.validateSync().errors.text);
});
