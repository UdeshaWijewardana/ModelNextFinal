// Isolated HTTP regression tests. No .env loading or database connection.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const owner = new mongoose.Types.ObjectId().toString();
const other = new mongoose.Types.ObjectId().toString();
const eventId = new mongoose.Types.ObjectId().toString();
let records, approval, filters, writes;
const matches = (record, filter) => Object.entries(filter).every(([key, value]) => String(record[key]) === String(value));
const query = value => ({ sort() { return this; }, select() { return this; }, populate() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const Event = {
  find(filter) { filters.push(filter); return query(records.filter(record => matches(record, filter))); },
  findOne(filter) { filters.push(filter); return query(records.find(record => matches(record, filter))); },
  async create(input) { writes++; const record = { ...input, _id: eventId, status: 'pending' }; records.push(record); return record; },
};
const Account = { findById(id) { return query([owner, other].includes(String(id)) ? { _id: id, name: 'Isolated owner', approvalStatus: approval } : null); } };
const accounts = Object.fromEntries(['client', 'photographer', 'agency', 'model'].map(role => [role, Account]));
const loaded = new Map();
const load = relative => {
  const absolute = path.resolve(__dirname, '..', relative);
  if (loaded.has(absolute)) return loaded.get(absolute);
  const module = { exports: {} };
  const localRequire = specifier => {
    if (specifier === 'mongoose') return { ...mongoose, connection: { readyState: 1 } };
    if (specifier.endsWith('/models/Event')) return Event;
    if (specifier.endsWith('/models/EventRequest')) return { find: () => query([]) };
    if (specifier.includes('/models/')) return Account;
    if (specifier === './authRoutes') return { accountModels: accounts };
    if (specifier.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(absolute), `${specifier}.js`)));
    return require(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports){${fs.readFileSync(absolute, 'utf8')}\n})`, { filename: absolute })(localRequire, module, module.exports);
  loaded.set(absolute, module.exports);
  return module.exports;
};
const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'isolated-event-test-secret';
const app = express();
app.use(express.json());
app.use('/api/events', load('routes/eventRoutes.js').router);
let server, origin;
test.before(async () => {
  server = http.createServer(app).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}/api/events`;
});
test.beforeEach(() => { records = []; approval = 'approved'; filters = []; writes = 0; });
test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
});
const request = async (endpoint, { role = 'client', id = owner, method = 'GET', body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (id) headers.cookie = `modelnext_user_session=${jwt.sign({ role }, process.env.JWT_SECRET, { subject: id, expiresIn: '1h' })}`;
  const response = await fetch(origin + endpoint, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json(), headers: response.headers };
};

for (const role of ['client', 'photographer', 'agency']) {
  test(`${role}: mine and details scope ownership by authenticated ID and role`, async () => {
    records = [
      { _id: eventId, title: 'Own pending event', ownerId: owner, ownerRole: role, status: 'pending', rejectionReason: 'Private review' },
      { _id: new mongoose.Types.ObjectId(), title: 'Another owner', ownerId: other, ownerRole: role, status: 'approved' },
      { _id: new mongoose.Types.ObjectId(), title: 'Same ID, different role', ownerId: owner, ownerRole: 'model', status: 'approved' },
    ];
    const mine = await request('/mine?ownerId=' + other, { role });
    assert.equal(mine.status, 200);
    assert.deepEqual(mine.data.events.map(event => event.title), ['Own pending event']);
    assert.deepEqual(filters[0], { ownerId: owner, ownerRole: role });
    assert.match(mine.headers.get('cache-control'), /no-store/);
    const details = await request('/mine/' + eventId, { role });
    assert.equal(details.status, 200);
    assert.equal(details.data.event.rejectionReason, 'Private review');
    assert.equal((await request('/mine/' + eventId, { role, id: other })).status, 404);
    assert.equal((await request('/mine/' + eventId, { role: 'model' })).status, 404);
    assert.equal((await request('/' + eventId, { role, id: other, method: 'PATCH', body: {} })).status, 404);
    assert.equal((await request('/' + eventId, { role, id: other, method: 'DELETE' })).status, 404);
    assert.equal((await request('/mine/' + eventId, { id: null })).status, 401);
    approval = 'rejected';
    assert.equal((await request('/mine/' + eventId, { role })).status, 403);
  });
  test(`${role}: create derives ownership from session and pending event opens privately`, async () => {
    const body = { title: 'Isolated event', eventType: 'Runway', startDate: '2026-11-10T10:00:00Z', location: 'Test location', description: 'Test description', ownerId: other, ownerRole: 'model', status: 'approved' };
    const created = await request('', { role, method: 'POST', body });
    assert.equal(created.status, 201);
    assert.equal(created.data.event.ownerId, owner);
    assert.equal(created.data.event.ownerRole, role);
    assert.equal(created.data.event.status, 'pending');
    assert.equal((await request('/mine/' + created.data.event.id, { role })).status, 200);
    assert.equal((await request('')).data.events.length, 0);
  });
}
test('invalid identifiers and dates fail before database writes', async () => {
  assert.equal((await request('/mine/invalid')).status, 400);
  const body = { title: 'Isolated event', eventType: 'Runway', startDate: 'invalid', location: 'Test', description: 'Test' };
  assert.equal((await request('', { method: 'POST', body })).status, 400);
  body.startDate = '2026-11-10T10:00:00Z'; body.endDate = '2026-11-09T10:00:00Z';
  assert.equal((await request('', { method: 'POST', body })).status, 400);
  assert.equal(writes, 0);
});
