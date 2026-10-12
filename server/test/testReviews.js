const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const { reviewValues, validationError, normalizeSummary } = require('../routes/reviewRoutes');

const id = () => new mongoose.Types.ObjectId();
const validReview = () => ({ reviewerId: id(), reviewerRole: 'client', recipientId: id(), recipientRole: 'model', rating: 5, reviewText: 'Professional and reliable.' });

test('review schema supports all reviewer roles and only eligible recipient roles', () => {
  for (const reviewerRole of ['client', 'model', 'photographer', 'agency']) {
    assert.equal(new Review({ ...validReview(), reviewerRole }).validateSync(), undefined);
  }
  assert.ok(new Review({ ...validReview(), recipientRole: 'client' }).validateSync().errors.recipientRole);
});

test('review rating is an integer from one to five and text is bounded', () => {
  for (const rating of [1, 2, 3, 4, 5]) assert.equal(new Review({ ...validReview(), rating }).validateSync(), undefined);
  for (const rating of [0, 2.5, 6]) assert.ok(new Review({ ...validReview(), rating }).validateSync().errors.rating);
  assert.ok(new Review({ ...validReview(), reviewText: 'x'.repeat(1001) }).validateSync().errors.reviewText);
});

test('compound unique index prevents duplicate reviewer and recipient identities', () => {
  const index = Review.schema.indexes().find(([keys, options]) => options.unique && keys.reviewerId === 1 && keys.reviewerRole === 1 && keys.recipientId === 1 && keys.recipientRole === 1);
  assert.ok(index);
});

test('request validation trims feedback and rejects invalid values', () => {
  assert.deepEqual(reviewValues({ rating: '4', reviewText: '  Helpful feedback  ' }), { rating: 4, reviewText: 'Helpful feedback' });
  assert.equal(validationError({ rating: 4, reviewText: '' }), false);
  assert.equal(validationError({ rating: 4.5, reviewText: '' }), true);
  assert.equal(validationError({ rating: 5, reviewText: 'x'.repeat(1001) }), true);
});

test('public rating summaries round the genuine aggregate and preserve count', () => {
  assert.deepEqual(normalizeSummary({ averageRating: (5 + 4 + 4) / 3, reviewCount: 3 }), { averageRating: 4.3, reviewCount: 3 });
  assert.deepEqual(normalizeSummary(), { averageRating: 0, reviewCount: 0 });
});
