const crypto = require('crypto');
const mongoose = require('mongoose');
const LivenessVerificationSession = require('./LivenessVerificationSession');

// Browser-reported prototype liveness sessions expire after ten minutes and are single-use.
const SESSION_TTL_MS = 10 * 60 * 1000;

function createLivenessVerificationSessionService({
  model = LivenessVerificationSession,
  useDatabase = () => mongoose.connection.readyState === 1,
  now = () => new Date(),
} = {}) {
  // Raw token database eke nopenna SHA-256 hash karala witharak store karanawa.
  const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

  // Session-related errors walata API response ekata yanna one code saha status eka set karanawa.
  const sessionError = (code, message, status = 400) => {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
  };

  // Verification token hash eken database record eka hoyanawa.
  const readSession = async (tokenHash) => {
    if (useDatabase()) {
      const session = await model.findOne({ tokenHash }).exec();
      return session ? { session, storage: 'database' } : null;
    }
    return null;
  };

  // Token dekama, expire wela nadda, saha balaporoththu wena status ekada kiyala validate karanawa.
  const validateSession = async ({ verificationId, attemptId }, requiredStatus) => {
    if (typeof verificationId !== 'string' || typeof attemptId !== 'string'
      || verificationId.length < 32 || attemptId.length < 24) {
      throw sessionError('LIVENESS_SESSION_INVALID', 'A valid liveness verification session is required.', 403);
    }

    const tokenHash = hash(verificationId);
    const attemptIdHash = hash(attemptId);
    const storedSession = await readSession(tokenHash);
    if (!storedSession || storedSession.session.attemptIdHash !== attemptIdHash) {
      throw sessionError('LIVENESS_SESSION_INVALID', 'The liveness verification session is invalid.', 403);
    }
    const { session, storage } = storedSession;

    if (new Date(session.expiresAt).getTime() <= now().getTime()) {
      if (storage === 'database') {
        await model.deleteOne({ _id: session._id, expiresAt: { $lte: now() } });
      }
      throw sessionError('LIVENESS_SESSION_EXPIRED', 'The liveness verification session expired. Please verify again.', 410);
    }

    if (session.status !== requiredStatus) {
      const statusCode = session.status === 'consumed' || session.status === 'consuming' ? 409 : 403;
      const code = session.status === 'consumed'
        ? 'LIVENESS_SESSION_CONSUMED'
        : session.status === 'consuming'
          ? 'LIVENESS_SESSION_IN_USE'
          : 'LIVENESS_SESSION_INCOMPLETE';
      throw sessionError(code, 'Complete liveness verification before submitting registration.', statusCode);
    }

    return { tokenHash, attemptIdHash, session, storage };
  };

  // Status saha expiry condition ekka atomic update karala sessioni replay/double-use eka walakwanawa.
  const transition = async ({ verificationId, attemptId }, fromStatus, toStatus, timestampField) => {
    const validated = await validateSession({ verificationId, attemptId }, fromStatus);
    const timestamp = now();

    if (validated.storage === 'database') {
      const updated = await model.findOneAndUpdate(
        {
          _id: validated.session._id,
          tokenHash: validated.tokenHash,
          attemptIdHash: validated.attemptIdHash,
          status: fromStatus,
          expiresAt: { $gt: timestamp },
        },
        { $set: { status: toStatus, ...(timestampField ? { [timestampField]: timestamp } : {}) } },
        { new: true },
      ).exec();

      if (!updated) {
        throw sessionError('LIVENESS_SESSION_INVALID', 'The liveness verification session is no longer valid.', 409);
      }
      return;
    }

  };

  const evidenceTypes = new Set(['front', 'left', 'right']);

  // Registration ta ona views thunema session ekata attach wela thiyenawada kiyala balanne.
  const assertEvidence = (session) => {
    const missing = [...evidenceTypes].filter((type) => !session.evidence?.[type]?.path);
    if (missing.length) {
      throw sessionError('LIVENESS_EVIDENCE_INCOMPLETE', 'Capture each required liveness view before completing verification.', 403);
    }
  };

  const service = {
    async start() {
      // Aluth verification ekakata expire wena session ekak saha wenama attempt token ekak hadanawa.
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);
      const verificationId = crypto.randomBytes(32).toString('base64url');
      const attemptId = crypto.randomBytes(24).toString('base64url');
      const record = {
        tokenHash: hash(verificationId),
        attemptIdHash: hash(attemptId),
        status: 'pending',
        createdAt,
        expiresAt,
        completedAt: null,
        consumedAt: null,
      evidence: {},
      };

      // The session records browser-reported prototype challenge completion, not independently verified physical movement.
      // No camera frames, landmarks, or biometric templates are accepted or stored here.
      if (!useDatabase()) throw sessionError('DATABASE_UNAVAILABLE', 'Database service is currently unavailable. Please try again later.', 503);
      await model.create(record);

      return { verificationId, attemptId, expiresAt: expiresAt.toISOString() };
    },

    async complete(credentials) {
      // Evidence views thunama attach unama pending session eka completed karanawa.
      const validated = await validateSession(credentials, 'pending');
      assertEvidence(validated.session);
      try {
        await transition(credentials, 'pending', 'completed', 'completedAt');
      } catch (error) {
        if (error.code !== 'LIVENESS_SESSION_INCOMPLETE') throw error;
        await validateSession(credentials, 'completed');
      }
    },

    async assertCompleted(credentials) {
      // Registration submit karaddi session eka complete saha valid da kiyala meken balanne.
      await validateSession(credentials, 'completed');
    },

    async recordEvidence(credentials, type, evidence) {
      // Evidence path saha digest eka token walin hoyapu me session ekata link karala save karanawa.
      if (!evidenceTypes.has(type) || !evidence?.path || !evidence?.digest) {
        throw sessionError('LIVENESS_EVIDENCE_INVALID', 'A valid liveness evidence image is required.', 400);
      }

      const validated = await validateSession(credentials, 'pending');
      const existing = validated.session.evidence?.[type];
      if (existing?.digest) {
        if (existing.digest === evidence.digest) return { reused: true, evidence: existing };
        throw sessionError('LIVENESS_EVIDENCE_EXISTS', 'This liveness view has already been captured for the session.', 409);
      }

      const capture = { path: evidence.path, digest: evidence.digest, capturedAt: now() };
      const field = `evidence.${type}`;
      const updated = await model.findOneAndUpdate(
        {
          _id: validated.session._id,
          tokenHash: validated.tokenHash,
          attemptIdHash: validated.attemptIdHash,
          status: 'pending',
          [`${field}.path`]: { $exists: false },
          expiresAt: { $gt: now() },
        },
        { $set: { [field]: capture } },
        { new: true },
      ).exec();

      if (updated) return { reused: false, evidence: capture };

      const current = await readSession(validated.tokenHash);
      const currentEvidence = current?.session?.evidence?.[type];
      if (currentEvidence?.digest === evidence.digest) return { reused: true, evidence: currentEvidence };
      throw sessionError('LIVENESS_EVIDENCE_INVALID', 'The liveness session is no longer available for evidence capture.', 409);
    },

    async getCompletedEvidence(credentials) {
      // Complete session ekata adala evidence references registration ekata return karanawa.
      const validated = await validateSession(credentials, 'completed');
      assertEvidence(validated.session);
      return validated.session.evidence;
    },

    async claim(credentials) {
      // Registration evidence use karanna patan gaththama session eka temporary in-use karanawa.
      await transition(credentials, 'completed', 'consuming', null);
    },

    async consume(credentials) {
      // Registration save unata passe session eka consumed karala aye use kirima nawathwanawa.
      await transition(credentials, 'consuming', 'consumed', 'consumedAt');
    },

    async release(credentials) {
      // Registration save nokara fail unoth retry karanna completed status ekata nawatha harawanawa.
      await transition(credentials, 'consuming', 'completed', null);
    },
  };

  return service;
}

const livenessVerificationSessionService = createLivenessVerificationSessionService();

module.exports = {
  SESSION_TTL_MS,
  createLivenessVerificationSessionService,
  livenessVerificationSessionService,
};
