const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const DirectBooking = require('../models/DirectBooking');
const PrivateMessage = require('../models/PrivateMessage');
const { isParty, completionEligibility } = require('../bookingAccess');

const id = () => new mongoose.Types.ObjectId();
const validBooking = () => ({ requesterId: id(), requesterRole: 'client', requesterName: 'Requester', talentId: id(), talentRole: 'model', talentName: 'Talent', jobType: 'Commercial Shoot', bookingDate: '2026-12-10', location: 'Colombo', description: 'Campaign shoot' });

test('direct booking preserves existing statuses and accepts completed', () => {
  const booking = new DirectBooking(validBooking());
  assert.equal(booking.status, 'pending');
  for (const status of ['pending', 'confirmed', 'declined', 'completed']) { booking.status = status; assert.equal(booking.validateSync(), undefined); }
  booking.status = 'cancelled'; assert.match(booking.validateSync().message, /status/);
});

test('completion is limited to the customer of a confirmed booking on or after its valid service date', () => {
  const booking = { ...validBooking(), status: 'confirmed' };
  const customer = { id: booking.requesterId, role: booking.requesterRole };
  assert.equal(completionEligibility(booking, customer, '2026-12-10'), null);
  assert.equal(completionEligibility(booking, customer, '2026-12-11'), null);
  assert.equal(completionEligibility(booking, customer, '2026-12-09').status, 409);
  assert.equal(completionEligibility(booking, { id: booking.talentId, role: booking.talentRole }, '2026-12-10').status, 403);
  for (const status of ['pending', 'declined', 'completed']) {
    assert.equal(completionEligibility({ ...booking, status }, customer, '2026-12-10').status, 409);
  }
  assert.equal(completionEligibility({ ...booking, bookingDate: 'not-a-date' }, customer, '2026-12-10').status, 409);
  assert.equal(completionEligibility({ ...booking, bookingDate: '2026-02-30' }, customer, '2026-12-10').status, 409);
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
