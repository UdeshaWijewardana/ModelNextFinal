const assert = require('node:assert/strict');
const express = require('express');
const { createLivenessVerificationSessionService } = require('../services/livenessVerificationSessionService');
const adminRoutes = require('../routes/adminRoutes');

const sessions = [];
let timestamp = new Date('2026-10-05T00:00:00.000Z');

const readPath = (value, path) => path.split('.').reduce((current, key) => current?.[key], value);
const writePath = (value, path, nextValue) => {
  const keys = path.split('.');
  const finalKey = keys.pop();
  const target = keys.reduce((current, key) => (current[key] ||= {}), value);
  target[finalKey] = nextValue;
};

const matches = (session, query) => Object.entries(query).every(([key, expected]) => {
  const actual = readPath(session, key);
  if (expected && typeof expected === 'object' && '$gt' in expected) return actual > expected.$gt;
  if (expected && typeof expected === 'object' && '$exists' in expected) return expected.$exists ? actual !== undefined : actual === undefined;
  return actual === expected;
});

const model = {
  async create(record) {
    const session = { ...record, _id: String(sessions.length + 1), evidence: {} };
    sessions.push(session);
    return session;
  },
  findOne(query) {
    return { exec: async () => sessions.find((session) => matches(session, query)) || null };
  },
  findOneAndUpdate(query, update) {
    return {
      exec: async () => {
        const session = sessions.find((candidate) => matches(candidate, query));
        if (!session) return null;
        for (const [key, value] of Object.entries(update.$set || {})) writePath(session, key, value);
        return session;
      },
    };
  },
  async deleteOne(query) {
    const index = sessions.findIndex((session) => matches(session, query));
    if (index >= 0) sessions.splice(index, 1);
  },
};

async function testLivenessEvidenceSession() {
  const service = createLivenessVerificationSessionService({
    model,
    useDatabase: () => true,
    now: () => new Date(timestamp),
  });
  const session = await service.start();

  await assert.rejects(service.complete(session), (error) => error.code === 'LIVENESS_EVIDENCE_INCOMPLETE');

  for (const type of ['front', 'left', 'right']) {
    const capture = { path: `verification-evidence/${type}.jpg`, digest: `${type}-digest` };
    const result = await service.recordEvidence(session, type, capture);
    assert.equal(result.reused, false);
    assert.equal(result.evidence.path, capture.path);
  }

  const repeated = await service.recordEvidence(session, 'front', {
    path: 'verification-evidence/front-retry.jpg',
    digest: 'front-digest',
  });
  assert.equal(repeated.reused, true, 'Same capture retry must not overwrite a stored frame.');
  await assert.rejects(
    service.recordEvidence(session, 'front', { path: 'verification-evidence/other.jpg', digest: 'other-digest' }),
    (error) => error.code === 'LIVENESS_EVIDENCE_EXISTS',
  );

  await service.complete(session);
  const evidence = await service.getCompletedEvidence(session);
  assert.deepEqual(Object.keys(evidence).sort(), ['front', 'left', 'right']);
  await service.claim(session);
  await service.consume(session);
  await assert.rejects(service.assertCompleted(session), (error) => error.code === 'LIVENESS_SESSION_CONSUMED');

  const app = express();
  app.use('/api/admin', adminRoutes);
  const listener = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${listener.address().port}/api/admin/registrations/model/000000000000000000000000/evidence/liveness-front`);
    assert.equal(response.status, 401, 'Liveness evidence must not be available without administrator authentication.');
  } finally {
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }

  console.log('Liveness evidence is session-bound, complete before confirmation, immutable per view, single-use, and blocked without admin authentication.');
}

testLivenessEvidenceSession().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
