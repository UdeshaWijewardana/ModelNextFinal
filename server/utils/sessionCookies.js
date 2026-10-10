const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');

const USER_SESSION_COOKIE = 'modelnext_user_session';
const ADMIN_SESSION_COOKIE = 'modelnext_admin_session';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
});

const readCookie = (request, name) => {
  const header = request.get('cookie') || '';
  const prefix = `${name}=`;
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
};

const clearCookie = (response, name) => response.clearCookie(name, {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

const issueUserSession = (account, role) => jwt.sign(
  { role },
  process.env.JWT_SECRET,
  { subject: account._id.toString(), expiresIn: '8h', jwtid: randomUUID() }
);

module.exports = { USER_SESSION_COOKIE, ADMIN_SESSION_COOKIE, cookieOptions, readCookie, clearCookie, issueUserSession };
