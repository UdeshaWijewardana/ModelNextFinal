const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Photographer = require('../models/Photographer');
const EventRequest = require('../models/EventRequest');

const schedules = [
  { available: ['2026-10-13', '2026-10-16', '2026-10-20', '2026-10-23', '2026-10-27', '2026-10-30', '2026-11-03', '2026-11-06', '2026-11-10', '2026-11-13', '2026-11-18', '2026-11-21', '2026-11-25'], unavailable: ['2026-10-15', '2026-10-19', '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22'] },
  { available: ['2026-10-14', '2026-10-17', '2026-10-21', '2026-10-24', '2026-10-28', '2026-10-31', '2026-11-04', '2026-11-07', '2026-11-11', '2026-11-14', '2026-11-19', '2026-11-23', '2026-11-27', '2026-11-29'], unavailable: ['2026-10-18', '2026-10-22', '2026-10-26', '2026-10-29', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-24'] },
];
const dateKey = (value) => value.toISOString().slice(0, 10);
const today = () => dateKey(new Date());
const isLocalTarget = (uri) => ['localhost', '127.0.0.1'].includes(new URL(uri).hostname);
const isDevelopmentDatabaseName = (database) => /(^|[-_])(dev|development|test)([-_]|$)/i.test(database);

const bookedDateSet = async (photographerId) => {
  const requests = await EventRequest.find({ requesterId: photographerId, requesterRole: 'photographer', requestType: 'participation', status: 'confirmed' }).select('eventId').populate({ path: 'eventId', select: 'startDate endDate status' }).lean();
  const dates = new Set();
  requests.forEach(({ eventId }) => {
    if (!eventId?.startDate || eventId.status !== 'approved') return;
    const end = new Date(eventId.endDate || eventId.startDate);
    for (let current = new Date(eventId.startDate); current <= end; current.setUTCDate(current.getUTCDate() + 1)) dates.add(dateKey(current));
  });
  return dates;
};

async function main() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) throw new Error('Refusing to seed: MONGO_URI is not configured.');
  await mongoose.connect(uri);
  if (!isLocalTarget(uri) && !isDevelopmentDatabaseName(mongoose.connection.name)) throw new Error('Refusing to seed: the connected database is not an identifiable local/development database.');
  const photographers = await Photographer.find({ approvalStatus: 'approved' }).select('name manualAvailability').sort({ _id: 1 });
  const results = [];
  for (const [index, photographer] of photographers.entries()) {
    const schedule = schedules[index % schedules.length]; const existing = new Set((photographer.manualAvailability || []).map((entry) => entry.date)); const booked = await bookedDateSet(photographer._id); let availableInserted = 0; let unavailableInserted = 0; let skipped = 0;
    for (const status of ['available', 'unavailable']) for (const date of schedule[status]) {
      if (date < today() || existing.has(date) || booked.has(date)) { skipped += 1; continue; }
      photographer.manualAvailability.push({ date, status }); existing.add(date); if (status === 'available') availableInserted += 1; else unavailableInserted += 1;
    }
    if (availableInserted || unavailableInserted) await photographer.save();
    results.push({ name: photographer.name, availableInserted, unavailableInserted, skipped, bookedDates: booked.size });
  }
  console.log(JSON.stringify({ database: mongoose.connection.name, approvedPhotographers: photographers.length, results }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
