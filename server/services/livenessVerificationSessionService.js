const crypto = require('crypto');
const mongoose = require('mongoose');
const LivenessVerificationSession = require('../models/LivenessVerificationSession');

// Browser-reported prototype liveness sessions expire after ten minutes and are single-use.
const SESSION_TTL_MS = 10 * 60 * 1000;

function createLivenessVerificationSessionService({
  model = LivenessVerificationSession,
  useDatabase = () => mongoose.connection.readyState === 1,
  now = () => new Date(),
} = {}) {
  const localSessions = new Map();

  const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

  const sessionError = (code, message, status = 400) => {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
  };

  const readSession = async (tokenHash) => {
    const localSession = localSessions.get(tokenHash);
    if (localSession) return { session: localSession, storage: 'local' };
    if (useDatabase()) {
      const session = await model.findOne({ tokenHash }).exec();
      return session ? { session, storage: 'database' } : null;
    }
    return null;
  };

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
      } else {
        localSessions.delete(tokenHash);
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

    const current = localSessions.get(validated.tokenHash);
    if (!current || current.status !== fromStatus || current.expiresAt.getTime() <= timestamp.getTime()) {
      throw sessionError('LIVENESS_SESSION_INVALID', 'The liveness verification session is no longer valid.', 409);
    }
    current.status = toStatus;
    if (timestampField) current[timestampField] = timestamp;
  };

  const service = {
    async start() {
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
      };

      // The session records browser-reported prototype challenge completion, not independently verified physical movement.
      // No camera frames, landmarks, or biometric templates are accepted or stored here.
      if (useDatabase()) {
        await model.create(record);
      } else {
        for (const [tokenHash, session] of localSessions) {
          if (session.expiresAt.getTime() <= createdAt.getTime()) localSessions.delete(tokenHash);
        }
        localSessions.set(record.tokenHash, record);
      }

      return { verificationId, attemptId, expiresAt: expiresAt.toISOString() };
    },

    async complete(credentials) {
      try {
        await transition(credentials, 'pending', 'completed', 'completedAt');
      } catch (error) {
        if (error.code !== 'LIVENESS_SESSION_INCOMPLETE') throw error;
        await validateSession(credentials, 'completed');
      }
    },

    async assertCompleted(credentials) {
      await validateSession(credentials, 'completed');
    },

    async claim(credentials) {
      await transition(credentials, 'completed', 'consuming', null);
    },

    async consume(credentials) {
      await transition(credentials, 'consuming', 'consumed', 'consumedAt');
    },

    async release(credentials) {
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