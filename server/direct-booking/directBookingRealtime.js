const jwt = require('jsonwebtoken');
const { USER_SESSION_COOKIE, readCookie } = require('../utils/sessionCookies');
const { accountModels } = require('../routes/authRoutes');
const { findAccessibleBooking } = require('./bookingAccess');

const createDirectBookingRealtime = (io) => {
  const namespace = io.of('/direct-bookings');
  namespace.use(async (socket, next) => {
    try {
      const token = readCookie({ get: name => socket.request.headers?.[name.toLowerCase()] }, USER_SESSION_COOKIE);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const account = await accountModels[payload.role]?.findById(payload.sub).select('approvalStatus');
      if (!account || account.approvalStatus !== 'approved') throw new Error();
      socket.user = { id: payload.sub, role: payload.role }; next();
    } catch (_error) { next(new Error('Authentication is required.')); }
  });
  namespace.on('connection', socket => {
    socket.on('booking:join', async (bookingId, acknowledge = () => {}) => {
      try { const booking = await findAccessibleBooking(bookingId, socket.user, true); if (!booking) throw new Error(); await socket.join(`direct-booking:${bookingId}`); acknowledge({ ok: true }); }
      catch (_error) { acknowledge({ ok: false, error: 'Confirmed booking chat access is required.' }); }
    });
  });
  return { publish: (bookingId, message) => namespace.to(`direct-booking:${bookingId}`).emit('booking:message', message) };
};

module.exports = { createDirectBookingRealtime };
