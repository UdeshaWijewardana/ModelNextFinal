const DirectBooking = require('./models/DirectBooking');

const isParty = (booking, user) =>
  (String(booking.requesterId) === String(user.id) && booking.requesterRole === user.role) ||
  (String(booking.talentId) === String(user.id) && booking.talentRole === user.role);

const findAccessibleBooking = async (id, user, confirmed = false) => {
  const booking = await DirectBooking.findById(id);
  if (!booking || !isParty(booking, user)) return null;
  if (confirmed && !['confirmed', 'completed'].includes(booking.status)) return null;
  return booking;
};

const completionEligibility = (booking, user, today) => {
  if (String(booking.requesterId) !== String(user.id) || booking.requesterRole !== user.role) {
    return { status: 403, error: 'Only the booking customer can mark this booking as completed.' };
  }
  if (booking.status !== 'confirmed') {
    return { status: 409, error: 'Only a confirmed booking can be marked as completed.' };
  }
  const serviceDate = String(booking.bookingDate || '');
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(serviceDate) ? new Date(`${serviceDate}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== serviceDate) {
    return { status: 409, error: 'This booking has no reliable service date and cannot be completed.' };
  }
  if (serviceDate > today) {
    return { status: 409, error: 'This booking cannot be completed before its service date.' };
  }
  return null;
};

module.exports = { isParty, findAccessibleBooking, completionEligibility };
