const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ModelUser = require('../models/ModelUser');
const EventRequest = require('../models/EventRequest');

const schedules = {
  'Soren Wijeratne': {
    available: ['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-21', '2026-10-24', '2026-10-27', '2026-10-30', '2026-11-03', '2026-11-05', '2026-11-09', '2026-11-12', '2026-11-16', '2026-11-20', '2026-11-24', '2026-11-28'],
    unavailable: ['2026-10-18', '2026-10-22', '2026-10-25', '2026-10-29', '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-26'],
  },
  'Kael Perera': {
    available: ['2026-10-14', '2026-10-17', '2026-10-20', '2026-10-23', '2026-10-26', '2026-10-31', '2026-11-02', '2026-11-06', '2026-11-10', '2026-11-13', '2026-11-18', '2026-11-23', '2026-11-27'],
    unavailable: ['2026-10-15', '2026-10-19', '2026-10-24', '2026-10-28', '2026-11-04', '2026-11-11', '2026-11-17', '2026-11-25'],
  },
};

const dateKey = (value) => value.toISOString().slice(0, 10);
const today = () => dateKey(new Date());

const isLocalTarget = (uri) => {
  const parsed = new URL(uri);
  return ['localhost', '127.0.0.1'].includes(parsed.hostname);
};

const isDevelopmentDatabaseName = (database) => /(^|[-_])(dev|development|test)([-_]|$)/i.test(database);

const bookedDateSet = async (modelId) => {
  const requests = await EventRequest.find({
    requesterId: modelId,
    requesterRole: 'model',
    requestType: 'booking',
    status: 'confirmed',
  }).select('eventId').populate({ path: 'eventId', select: 'startDate endDate status' }).lean();

  const dates = new Set();
  requests.forEach(({ eventId }) => {
    if (!eventId || eventId.status !== 'approved' || !eventId.startDate) return;
    const end = new Date(eventId.endDate || eventId.startDate);
    for (let current = new Date(eventId.startDate); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
      dates.add(dateKey(current));
    }
  });
  return dates;
};

const main = async () => {
  const uri = process.env.MONGO_URI || '';
  if (!uri) throw new Error('Refusing to seed: MONGO_URI is not configured.');

  await mongoose.connect(uri);
  if (!isLocalTarget(uri) && !isDevelopmentDatabaseName(mongoose.connection.name)) {
    throw new Error('Refusing to seed: the connected database is not an identifiable local/development database.');
  }
  const models = await Promise.all(Object.keys(schedules).map(async (fullName) => {
    const matches = await ModelUser.find({ fullName, approvalStatus: 'approved' }).select('fullName approvalStatus manualAvailability');
    if (matches.length !== 1) throw new Error(`Expected one approved model named ${fullName}, found ${matches.length}.`);
    return matches[0];
  }));

  for (const model of models) {
    const existing = new Set((model.manualAvailability || []).map((entry) => entry.date));
    const booked = await bookedDateSet(model._id);
    const schedule = schedules[model.fullName];
    let inserted = 0;

    ['available', 'unavailable'].forEach((status) => {
      schedule[status].forEach((date) => {
        if (date >= today() && !existing.has(date) && !booked.has(date)) {
          model.manualAvailability.push({ date, status });
          inserted += 1;
        }
      });
    });

    if (inserted) await model.save();
    console.log(`${model.fullName}: inserted ${inserted} non-conflicting availability preferences.`);
  }
};

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
