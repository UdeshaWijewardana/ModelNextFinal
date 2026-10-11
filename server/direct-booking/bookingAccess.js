const DirectBooking = require('./models/DirectBooking');

const isParty = (booking, user) =>
  (String(booking.requesterId) === String(user.id) && booking.requesterRole === user.role) ||
  (String(booking.talentId) === String(user.id) && booking.talentRole === user.role);

const findAccessibleBooking = async (id, user, confirmed = false) => {
  const booking = await DirectBooking.findById(id);
  if (!booking || !isParty(booking, user)) return null;
  if (confirmed && booking.status !== 'confirmed') return null;
  return booking;
};

module.exports = { isParty, findAccessibleBooking };
