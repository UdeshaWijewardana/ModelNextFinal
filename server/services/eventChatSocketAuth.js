const { requireUser } = require('../middleware/requireUser');
const { fail } = require('./eventChatService');

// Adapt IncomingMessage to the existing Express middleware. Cookie parsing,
// JWT verification/expiry, role lookup, and approval checks remain centralized.
const authenticateSocketRequest = (request) => new Promise((resolve, reject) => {
  const req = { get: (name) => request.headers?.[name.toLowerCase()] };
  const res = {
    statusCode: 401,
    status(status) { this.statusCode = status; return this; },
    json(body) { reject(fail(this.statusCode, body.error)); return this; },
  };
  Promise.resolve(requireUser(req, res, () => resolve({ id: req.user.id, role: req.user.role })))
    .catch(() => reject(fail(401, 'Authentication is invalid or expired.')));
});

module.exports = { authenticateSocketRequest };