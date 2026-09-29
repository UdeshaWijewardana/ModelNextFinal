const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');
const modelRoutes = require('../routes/modelRoutes');
const {
  createLivenessVerificationSessionService,
  SESSION_TTL_MS,
} = require('../services/livenessVerificationSessionService');

const serverRoot = path.resolve(__dirname, '..');
const uploadBytes = Buffer.from('prototype-registration-upload');
const savedModels = [];
const createdUploads = [];
let clock = new Date('2026-09-29T00:00:00.000Z');

const sessionService = createLivenessVerificationSessionService({
  useDatabase: () => false,
  now: () => new Date(clock),
});

function createRegistrationForm({
  fullName = 'Jane Doe',
  birthdate = '2000-01-01',
  email = `${crypto.randomBytes(8).toString('hex')}@example.test`,
  verificationId,
  attemptId,
  includeFrontendFlag = false,
  omitPortfolio = false,
} = {}) {
  const form = new FormData();
  form.append('fullName', fullName);
  form.append('birthdate', birthdate);
  form.append('idType', 'nic');
  form.append('email', email);
  form.append('password', 'test-only-password');
  form.append('location', 'Test location');
  form.append('phone', '0000000000');
  form.append('weight', '60');
  form.append('height', '170');
  form.append('waist', '65');
  form.append('hip', '90');
  form.append('verified', 'true');
  form.append('verification', JSON.stringify({ verified: true }));
  if (includeFrontendFlag) form.append('livenessVerified', 'true');
  if (verificationId) form.append('livenessVerificationId', verificationId);
  if (attemptId) form.append('livenessAttemptId', attemptId);

  const fileSuffix = crypto.randomBytes(6).toString('hex');
  for (const field of ['idFront', 'idBack', 'selfieMedia', 'profileImage']) {
    const filename = `${field}-${fileSuffix}.png`;
    form.append(field, new Blob([uploadBytes], { type: 'image/png' }), filename);
  }
  if (!omitPortfolio) {
    for (let index = 0; index < 6; index += 1) {
      form.append('portfolio', new Blob([uploadBytes], { type: 'image/png' }), `portfolio-${fileSuffix}-${index}.png`);
    }
  }
  return form;
}

async function post(baseUrl, endpoint, body, isJson = false) {
  const response = await fetch(`${baseUrl}/api/models/${endpoint}`, {
    method: 'POST',
    headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    body: isJson ? JSON.stringify(body) : body,
  });
  return { response, body: await response.json() };
}

async function createCompletedSession(baseUrl) {
  const started = await post(baseUrl, 'liveness/start', {});
  assert.equal(started.response.status, 201);
  assert.equal(started.body.verificationId.length >= 32, true);
  assert.equal(started.body.attemptId.length >= 24, true);
  assert.equal(new Date(started.body.expiresAt).getTime() - clock.getTime(), SESSION_TTL_MS);
  const completion = await post(baseUrl, 'liveness/complete', started.body, true);
  assert.equal(completion.response.status, 200);
  return started.body;
}

async function register(baseUrl, options = {}) {
  return post(baseUrl, 'register', createRegistrationForm(options));
}

async function removeStoredUpload(relativePath) {
  if (!relativePath) return;
  try {
    await fs.promises.unlink(path.resolve(serverRoot, relativePath));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function testLivenessRegistration() {
  assert.equal(mongoose.connection.readyState, 0, 'Test must not connect to a real database.');

  let databaseReady = false;
  const startupFallbackService = createLivenessVerificationSessionService({
    useDatabase: () => databaseReady,
  });
  const startupFallbackSession = await startupFallbackService.start();
  databaseReady = true;
  await startupFallbackService.complete(startupFallbackSession);
  await startupFallbackService.assertCompleted(startupFallbackSession);
  await startupFallbackService.claim(startupFallbackSession);
  await startupFallbackService.consume(startupFallbackSession);

  const app = express();
  app.use(express.json());
  app.use('/api/models', modelRoutes);
  app.locals.livenessVerificationSessionService = sessionService;
  app.locals.readLocalModels = () => savedModels;
  app.locals.writeLocalModels = (models) => savedModels.splice(0, savedModels.length, ...models);
  app.locals.verifyIdentityDocument = async ({ fullName, birthdate }) => {
    if (fullName === 'Unreadable Document') {
      const error = new Error('test unreadable image');
      error.code = 'OCR_UNREADABLE_IMAGE';
      throw error;
    }
    const checks = {
      nameMatch: fullName === 'Jane Doe',
      dateOfBirthMatch: birthdate === '2000-01-01',
    };
    return {
      verified: checks.nameMatch && checks.dateOfBirthMatch,
      checks,
      extracted: { fullName: 'Jane Doe', dateOfBirth: '2000-01-01' },
    };
  };

  const listener = await new Promise((resolve) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
  });
  const baseUrl = `http://127.0.0.1:${listener.address().port}`;

  try {
    const startingCount = savedModels.length;

    const missingSession = await register(baseUrl, { includeFrontendFlag: true });
    assert.equal(missingSession.response.status, 403, 'A forged frontend boolean must not replace a session.');
    assert.equal(savedModels.length, startingCount);

    const incompleteRegistrationSession = await createCompletedSession(baseUrl);
    const incompleteRegistration = await post(baseUrl, 'register', createRegistrationForm({
      verificationId: incompleteRegistrationSession.verificationId,
      attemptId: incompleteRegistrationSession.attemptId,
      omitPortfolio: true,
    }));
    assert.equal(incompleteRegistration.response.status, 400, 'Required profile and portfolio fields must be enforced on the backend.');
    assert.equal(savedModels.length, startingCount);

    const pending = await post(baseUrl, 'liveness/start', {});
    const incomplete = await register(baseUrl, {
      verificationId: pending.body.verificationId,
      attemptId: pending.body.attemptId,
    });
    assert.equal(incomplete.response.status, 403, 'An uncompleted session must be rejected.');
    assert.equal(savedModels.length, startingCount);

    const forged = await register(baseUrl, {
      verificationId: crypto.randomBytes(32).toString('base64url'),
      attemptId: crypto.randomBytes(24).toString('base64url'),
    });
    assert.equal(forged.response.status, 403, 'A fake session must be rejected.');
    assert.equal(savedModels.length, startingCount);

    const binding = await createCompletedSession(baseUrl);
    const wrongAttempt = await register(baseUrl, {
      verificationId: binding.verificationId,
      attemptId: crypto.randomBytes(24).toString('base64url'),
    });
    assert.equal(wrongAttempt.response.status, 403, 'A session must match its registration attempt.');

    const wrongNameSession = await createCompletedSession(baseUrl);
    const wrongName = await register(baseUrl, {
      fullName: 'John Smith',
      verificationId: wrongNameSession.verificationId,
      attemptId: wrongNameSession.attemptId,
    });
    assert.equal(wrongName.response.status, 400);
    assert.equal(savedModels.length, startingCount, 'OCR name mismatch must not write a fallback record.');
    await sessionService.assertCompleted(wrongNameSession);

    const wrongDobSession = await createCompletedSession(baseUrl);
    const wrongDob = await register(baseUrl, {
      birthdate: '2001-02-03',
      verificationId: wrongDobSession.verificationId,
      attemptId: wrongDobSession.attemptId,
    });
    assert.equal(wrongDob.response.status, 400);
    assert.equal(savedModels.length, startingCount, 'OCR DOB mismatch must not write a fallback record.');

    const bothWrongSession = await createCompletedSession(baseUrl);
    const bothWrong = await register(baseUrl, {
      fullName: 'John Smith',
      birthdate: '2001-02-03',
      verificationId: bothWrongSession.verificationId,
      attemptId: bothWrongSession.attemptId,
    });
    assert.equal(bothWrong.response.status, 400);
    assert.equal(savedModels.length, startingCount);

    const unreadableSession = await createCompletedSession(baseUrl);
    const unreadable = await register(baseUrl, {
      fullName: 'Unreadable Document',
      verificationId: unreadableSession.verificationId,
      attemptId: unreadableSession.attemptId,
    });
    assert.equal(unreadable.response.status, 400);
    assert.equal(savedModels.length, startingCount, 'OCR failure must not create a local fallback record.');
    await sessionService.assertCompleted(unreadableSession);

    const successfulSession = await createCompletedSession(baseUrl);
    const success = await register(baseUrl, {
      verificationId: successfulSession.verificationId,
      attemptId: successfulSession.attemptId,
    });
    assert.equal(success.response.status, 201);
    assert.equal(savedModels.length, startingCount + 1);
    createdUploads.push(
      success.body.model.profileImage,
      ...success.body.model.portfolioImages,
      success.body.model.idFrontImage,
      success.body.model.idBackImage,
      success.body.model.selfieMedia,
    );
    await assert.rejects(sessionService.assertCompleted(successfulSession), (error) => (
      error.code === 'LIVENESS_SESSION_CONSUMED'
    ));

    const reused = await register(baseUrl, {
      verificationId: successfulSession.verificationId,
      attemptId: successfulSession.attemptId,
    });
    assert.equal(reused.response.status, 409, 'A consumed session must not be reused.');
    assert.equal(savedModels.length, startingCount + 1);

    const expiringSession = await createCompletedSession(baseUrl);
    clock = new Date(clock.getTime() + SESSION_TTL_MS + 1);
    const expired = await register(baseUrl, {
      verificationId: expiringSession.verificationId,
      attemptId: expiringSession.attemptId,
    });
    assert.equal(expired.response.status, 410);
    assert.equal(savedModels.length, startingCount + 1);

    console.log('Missing, forged, incomplete, wrong-attempt, expired, and consumed sessions rejected.');
    console.log('Valid OCR + completed session registered once; token consumed.');
    console.log('Name, DOB, combined OCR mismatch, and OCR failure did not write local fallback records.');
  } finally {
    await Promise.all(createdUploads.map(removeStoredUpload));
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }
}

testLivenessRegistration().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});