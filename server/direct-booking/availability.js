const DirectBooking = require('./models/DirectBooking');

const directBookedDatesForMonth = async (talentId, talentRole, bounds) => {
  const start = bounds.start.toISOString().slice(0, 10);
  const end = bounds.end.toISOString().slice(0, 10);
  const bookings = await DirectBooking.find({ talentId, talentRole, status: 'confirmed', bookingDate: { $gte: start, $lt: end } }).select('bookingDate').lean();
  return bookings.map(item => item.bookingDate);
};

module.exports = { directBookedDatesForMonth };
