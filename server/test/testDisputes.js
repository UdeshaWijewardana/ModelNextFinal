const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Dispute = require('../models/Dispute');
const { disputeInput, invalidInput, isComplainant, isRespondent, disputeParties } = require('../routes/disputeRoutes');

const id = () => new mongoose.Types.ObjectId();
const validDispute = () => ({ bookingId: id(), complainantId: id(), complainantRole: 'client', respondentId: id(), respondentRole: 'model', reason: 'No-show', description: 'The provider did not arrive.' });

test('dispute schema supports the simple status lifecycle and validates input', () => {
  const dispute = new Dispute(validDispute());
  assert.equal(dispute.status, 'open');
  for (const status of ['open', 'under_review', 'resolved']) { dispute.status = status; assert.equal(dispute.validateSync(), undefined); }
  dispute.status = 'cancelled'; assert.ok(dispute.validateSync().errors.status);
  assert.ok(new Dispute({ ...validDispute(), reason: 'Unknown' }).validateSync().errors.reason);
  assert.ok(new Dispute({ ...validDispute(), description: 'short' }).validateSync().errors.description);
});

test('active duplicate disputes have a database-enforced partial unique index', () => {
  const index = Dispute.schema.indexes().find(([keys, options]) => options.unique && keys.bookingId === 1 && keys.complainantId === 1 && keys.complainantRole === 1);
  assert.ok(index);
  assert.deepEqual(index[1].partialFilterExpression, { $or: [{ status: 'open' }, { status: 'under_review' }] });
});

test('complainant and respondent are derived from exact booking IDs and roles', () => {
  const booking = { requesterId: id(), requesterRole: 'client', talentId: id(), talentRole: 'model' };
  const client = { id: booking.requesterId, role: 'client' };
  const model = { id: booking.talentId, role: 'model' };
  assert.deepEqual(disputeParties(booking, client), { respondentId: booking.talentId, respondentRole: 'model' });
  assert.deepEqual(disputeParties(booking, model), { respondentId: booking.requesterId, respondentRole: 'client' });
  const dispute = { complainantId: client.id, complainantRole: client.role, respondentId: model.id, respondentRole: model.role };
  assert.equal(isComplainant(dispute, client), true);
  assert.equal(isRespondent(dispute, model), true);
  assert.equal(isComplainant(dispute, { id: client.id, role: 'agency' }), false);
  assert.equal(isRespondent(dispute, { id: id(), role: 'model' }), false);
});

test('request input is trimmed and rejects invalid reasons or lengths', () => {
  const input = disputeInput({ reason: 'Payment issue', description: '  Payment was not processed correctly.  ' });
  assert.deepEqual(input, { reason: 'Payment issue', description: 'Payment was not processed correctly.' });
  assert.equal(invalidInput(input), false);
  assert.equal(invalidInput({ reason: 'Unknown', description: 'Long enough description' }), true);
  assert.equal(invalidInput({ reason: 'Other', description: 'Too short' }), true);
  assert.equal(invalidInput({ reason: 'Other', description: 'x'.repeat(1001) }), true);
});
