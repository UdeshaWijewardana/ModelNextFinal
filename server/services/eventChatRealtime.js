const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { USER_SESSION_COOKIE, readCookie } = require('../utils/sessionCookies');
const { authenticateSocketRequest } = require('./eventChatSocketAuth');
const { assertId, chatAccess, fail } = require('./eventChatService');
const { sendTextMessage } = require('./eventChatMessageService');

const socketError = (error) => {
  if (error.chatStatus) return { ok: false, status: error.chatStatus, error: error.message };
  if (error.code === 20 || error.code === 303) return { ok: false, status: 503, error: 'MongoDB transaction support is required.' };
  if (error.hasErrorLabel?.('UnknownTransactionCommitResult')) return { ok: false, status: 503, error: 'Unable to confirm the message. Refresh history or retry the same clientMessageId.' };
  if (error.code === 11000 || error.hasErrorLabel?.('TransientTransactionError')) return { ok: false, status: 409, error: 'A duplicate or concurrent message conflicted. Retry the same clientMessageId.' };
  return { ok: false, status: 500, error: 'Unable to complete the chat operation.' };
};
const payloadObject = (payload, allowedKeys) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some((key) => !allowedKeys.includes(key))) throw fail(400, 'Invalid socket payload.');
};
const roomName = (chatId) => `event-chat:${chatId}`;
const cookieFrom = (request) => {
  try { return readCookie({ get: (name) => request.headers?.[name.toLowerCase()] }, USER_SESSION_COOKIE); }
  catch (_error) { throw fail(401, 'Authentication is invalid or expired.'); }
};
const fingerprint = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createEventChatRealtime = (httpServer, {
  isAllowedOrigin,
  authenticate = authenticateSocketRequest,
  authorize = chatAccess,
  persistText = sendTextMessage,
  sweepIntervalMs = 15000,
  eventRateLimit = 60,
} = {}) => {
  if (typeof isAllowedOrigin !== 'function') throw new Error('A shared CORS origin predicate is required.');
  const io = new Server(httpServer, {
    cors: { origin: (origin, callback) => callback(null, isAllowedOrigin(origin)), credentials: true },
    // CORS alone does not reject cross-origin WebSocket handshakes.
    allowRequest: (request, callback) => callback(null, isAllowedOrigin(request.headers.origin)),
    maxHttpBufferSize: 32 * 1024,
    connectTimeout: 10000,
    serveClient: true,
    // Deliberately omit connectionStateRecovery: private packets/rooms must not
    // be restored without fresh authentication and membership checks.
  });
  const connections = new Map();
  const buckets = new Map();
  const revokedSessions = new Map();
  const broadcasts = new Map();
  let pendingHandshakes = 0;
  let saturationUntil = 0;
  let sweeping = false;
  let closed = false;

  const pruneRevocations = () => {
    for (const [key, until] of revokedSessions) if (until <= Date.now()) revokedSessions.delete(key);
  };
  const checkSession = (request) => {
    const token = cookieFrom(request);
    if (!token) throw fail(401, 'Authentication is required.');
    const key = fingerprint(token);
    const until = revokedSessions.get(key);
    if ((until && until > Date.now()) || saturationUntil > Date.now()) throw fail(401, 'This socket session has ended. Sign in again.');
    return key;
  };
  const freshUser = async (socket) => {
    checkSession(socket.request);
    const user = await authenticate(socket.request);
    checkSession(socket.request);
    const meta = connections.get(socket.id);
    if (meta && (user.id !== meta.user.id || user.role !== meta.user.role || meta.expiresAt <= Date.now())) throw fail(401, 'Authentication is invalid or expired.');
    return user;
  };
  const disconnectAccess = (socket, error) => {
    if (!socket.connected) return;
    socket.emit('chat:access_revoked', socketError(error));
    socket.disconnect(true);
  };
  const evictRoom = async (socket, chatId, error) => {
    connections.get(socket.id)?.joined.delete(chatId);
    await socket.leave(roomName(chatId));
    if (socket.connected) socket.emit('chat:access_revoked', { ...socketError(error), chatId });
  };

  io.use(async (socket, next) => {
    if (pendingHandshakes >= 100 || connections.size >= 1000 || closed) {
      const error = new Error('Chat service is busy. Please try again later.');
      error.data = { status: 503 };
      return next(error);
    }
    pendingHandshakes += 1;
    try {
      pruneRevocations();
      checkSession(socket.request);
      socket.data.user = await authenticate(socket.request);
      checkSession(socket.request);
      next();
    } catch (error) {
      const safe = socketError(error);
      const rejected = new Error(safe.error);
      rejected.data = { status: safe.status };
      next(rejected);
    } finally { pendingHandshakes -= 1; }
  });

  io.on('connection', (socket) => {
    const user = Object.freeze({ ...socket.data.user });
    const accountKey = `${user.role}:${user.id}`;
    const existing = [...connections.values()].filter((meta) => meta.accountKey === accountKey).length;
    if (connections.size >= 1000 || existing >= 10 || closed) return disconnectAccess(socket, fail(429, 'Too many active chat connections.'));
    // JWT was already verified by requireUser. Decode only to schedule expiry;
    // decoded claims never authorize the user or determine their role.
    const token = cookieFrom(socket.request);
    const decoded = jwt.decode(token);
    const expiresAt = Math.min(Number(decoded?.exp) * 1000 || Date.now() + 8 * 60 * 60 * 1000, Date.now() + 8 * 60 * 60 * 1000);
    const meta = { user, accountKey, sessionKey: fingerprint(token), expiresAt, joined: new Set(), queue: Promise.resolve(), inFlight: 0 };
    connections.set(socket.id, meta);
    const expiration = setTimeout(() => disconnectAccess(socket, fail(401, 'Authentication has expired.')), Math.max(1, expiresAt - Date.now()));
    expiration.unref();
    socket.once('disconnect', () => {
      clearTimeout(expiration);
      connections.delete(socket.id);
      if (![...connections.values()].some((entry) => entry.accountKey === accountKey)) buckets.delete(accountKey);
    });

    socket.use((packet, next) => {
      const ack = typeof packet[packet.length - 1] === 'function' ? packet[packet.length - 1] : null;
      if (!ack) { socket.emit('chat:error', { ok: false, status: 400, error: 'An acknowledgement callback is required.' }); return; }
      if (packet.length !== 3) return ack({ ok: false, status: 400, error: 'Send one payload object and an acknowledgement callback.' });
      if (!['chat:join', 'chat:leave', 'chat:send'].includes(packet[0])) return ack({ ok: false, status: 400, error: 'Unsupported chat event.' });
      const now = Date.now();
      const bucket = buckets.get(accountKey);
      const current = bucket && bucket.until > now ? bucket : { count: 0, until: now + 60000 };
      if (current.count >= eventRateLimit || meta.inFlight >= 2) return ack({ ok: false, status: 429, error: 'Too many chat requests. Please retry shortly.' });
      current.count += 1;
      buckets.set(accountKey, current);
      meta.inFlight += 1;
      next();
    });

    const action = (event, handler) => socket.on(event, (payload, ack) => {
      // Serialize join/leave/send on each socket; leave cannot race a pending join.
      const work = meta.queue.then(async () => {
        try {
          if (!socket.connected) return;
          const fresh = await freshUser(socket);
          const response = await handler(payload, fresh);
          if (socket.connected) ack({ ok: true, ...response });
        } catch (error) {
          const safe = socketError(error);
          if (socket.connected) ack(safe);
          if (safe.status === 401 || safe.status === 503) disconnectAccess(socket, error);
          else if (safe.status === 403) {
            // Account revocation disconnects the session; chat-only revocation
            // removes that room while preserving access to other chats.
            try { await freshUser(socket); }
            catch (authError) { disconnectAccess(socket, authError); return; }
            if (payload && typeof payload.chatId === 'string' && meta.joined.has(payload.chatId.toLowerCase())) await evictRoom(socket, payload.chatId.toLowerCase(), error);
          }
        } finally { meta.inFlight -= 1; }
      });
      meta.queue = work.catch(() => { disconnectAccess(socket, fail(503, 'Chat authorization is unavailable.')); });
    });

    action('chat:join', async (payload, fresh) => {
      payloadObject(payload, ['chatId']);
      assertId(payload.chatId, 'chat ID');
      const chatId = payload.chatId.toLowerCase();
      if (meta.joined.size >= 20 && !meta.joined.has(chatId)) throw fail(429, 'A connection can join at most 20 chats.');
      await authorize(chatId, fresh, 'member');
      if (socket.connected && meta.expiresAt > Date.now()) {
        await socket.join(roomName(chatId));
        meta.joined.add(chatId);
      }
      return { chatId };
    });
    action('chat:leave', async (payload) => {
      payloadObject(payload, ['chatId']);
      assertId(payload.chatId, 'chat ID');
      const chatId = payload.chatId.toLowerCase();
      meta.joined.delete(chatId);
      await socket.leave(roomName(chatId));
      return { chatId };
    });
    action('chat:send', async (payload, fresh) => {
      payloadObject(payload, ['chatId', 'text', 'clientMessageId']);
      assertId(payload.chatId, 'chat ID');
      const chatId = payload.chatId.toLowerCase();
      if (!meta.joined.has(chatId)) throw fail(403, 'Join this chat before sending messages.');
      const result = await persistText(chatId, fresh, payload);
      if (!result.replay) await publish(result.message).catch(() => {
        console.error('Event chat live delivery failed; message remains available in history.');
      });
      return result;
    });
  });

  const deliver = async (message) => {
    const chatId = String(message.chatId).toLowerCase();
    const room = roomName(chatId);
    // Never use io.to(room).emit(): sockets may still be in a room after access
    // was revoked. Every recipient is authorized against MongoDB immediately
    // before enqueueing the private packet, with no authorization cache.
    const recipients = [...io.of('/').sockets.values()].filter((socket) => socket.rooms.has(room));
    await Promise.all(recipients.map(async (socket) => {
      try {
        const fresh = await freshUser(socket);
        await authorize(chatId, fresh, 'member');
        const meta = connections.get(socket.id);
        if (socket.connected && meta && meta.expiresAt > Date.now() && socket.rooms.has(room) && meta.joined.has(chatId)) socket.emit('chat:message', { message });
      } catch (error) {
        if (error.chatStatus === 403 || error.chatStatus === 404) {
          try { await freshUser(socket); await evictRoom(socket, chatId, error); }
          catch (authError) { disconnectAccess(socket, authError); }
        } else disconnectAccess(socket, fail(503, 'Chat authorization is unavailable.'));
      }
    }));
  };
  const publish = (message) => {
    if (closed) return Promise.reject(new Error('Chat service is closed.'));
    const chatId = String(message.chatId).toLowerCase();
    const previous = broadcasts.get(chatId);
    if ((previous?.count || 0) >= 100 || (!previous && broadcasts.size >= 1000)) return Promise.reject(new Error('Live delivery queue is full.'));
    const entry = previous || { tail: Promise.resolve(), count: 0 };
    entry.count += 1;
    const work = entry.tail.catch(() => {}).then(() => deliver(message));
    entry.tail = work;
    broadcasts.set(chatId, entry);
    work.finally(() => { entry.count -= 1; if (entry.count === 0 && broadcasts.get(chatId) === entry) broadcasts.delete(chatId); }).catch(() => {});
    return work;
  };

  const revalidate = async () => {
    if (sweeping || closed) return;
    sweeping = true;
    try {
      pruneRevocations();
      await Promise.all([...io.of('/').sockets.values()].map(async (socket) => {
        try {
          const fresh = await freshUser(socket);
          for (const chatId of [...(connections.get(socket.id)?.joined || [])]) {
            try { await authorize(chatId, fresh, 'member'); }
            catch (error) { await evictRoom(socket, chatId, error); }
          }
        } catch (error) { disconnectAccess(socket, error); }
      }));
    } finally { sweeping = false; }
  };
  const sweep = setInterval(() => { revalidate().catch(() => {}); }, sweepIntervalMs);
  sweep.unref();

  const disconnectSession = (request) => {
    try {
      const token = cookieFrom(request);
      if (!token || !process.env.JWT_SECRET) return;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!payload.sub || !['model', 'photographer', 'agency', 'client'].includes(payload.role)) return;
      const key = fingerprint(token);
      const until = Math.min(Number(payload.exp) * 1000 || Date.now() + 8 * 60 * 60 * 1000, Date.now() + 8 * 60 * 60 * 1000);
      pruneRevocations();
      if (revokedSessions.size >= 10000 && !revokedSessions.has(key)) saturationUntil = Math.max(saturationUntil, until);
      else revokedSessions.set(key, until);
      for (const socket of io.of('/').sockets.values()) if (connections.get(socket.id)?.sessionKey === key) disconnectAccess(socket, fail(401, 'You have signed out.'));
    } catch (_error) { /* Logout must still clear an absent, expired, or malformed cookie. */ }
  };
  const revokeMember = async (chatId, user) => {
    for (const socket of io.of('/').sockets.values()) {
      const meta = connections.get(socket.id);
      if (meta?.user.id.toLowerCase() === String(user.id).toLowerCase() && meta.user.role === user.role && meta.joined.has(String(chatId).toLowerCase())) {
        await evictRoom(socket, String(chatId).toLowerCase(), fail(403, 'Your chat membership was removed.'));
      }
    }
  };
  httpServer.once('close', () => { closed = true; clearInterval(sweep); });
  const close = () => new Promise((resolve) => {
    closed = true;
    clearInterval(sweep);
    io.close(() => { connections.clear(); buckets.clear(); revokedSessions.clear(); resolve(); });
  });
  return { io, publish, revalidate, disconnectSession, revokeMember, close };
};

module.exports = { createEventChatRealtime };