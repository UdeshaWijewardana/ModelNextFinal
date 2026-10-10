// Isolated HTTP/security tests. Never load .env or connect to MongoDB.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const express = require('express');
const http = require('node:http');
const crypto = require('node:crypto');
const { io: socketClient } = require('socket.io-client');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const oid = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'));
const ids = { owner: oid(1), member: oid(2), other: oid(3), event: oid(10), chat: oid(20), invitation: oid(30), request: oid(40) };
const clone = (value) => {
  if (value instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(value.toString());
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
};
const get = (object, key) => key.split('.').reduce((value, part) => value?.[part], object);
const set = (object, key, value) => {
  const parts = key.split('.');
  let target = object;
  for (const part of parts.slice(0, -1)) target = target[part] ||= {};
  target[parts.at(-1)] = value;
};
const equal = (a, b) => String(a) === String(b);
const match = (object, filter) => Object.entries(filter).every(([key, expected]) => {
  if (key === '$or') return expected.some((entry) => match(object, entry));
  const actual = get(object, key);
  if (expected && typeof expected === 'object' && !(expected instanceof Date) && !(expected instanceof mongoose.Types.ObjectId)) {
    if ('$not' in expected) return !match({ value: actual }, { value: expected.$not });
    if ('$elemMatch' in expected) return Array.isArray(actual) && actual.some((entry) => match(entry, expected.$elemMatch));
    if ('$in' in expected) return expected.$in.some((entry) => equal(actual, entry));
    if ('$lt' in expected) return actual instanceof Date ? actual < expected.$lt : String(actual) < String(expected.$lt);
    if ('$regex' in expected) return new RegExp(expected.$regex, expected.$options).test(actual || '');
  }
  return equal(actual, expected);
});
const project = (record, projection) => {
  if (!record) return record;
  if (!projection || projection.startsWith('+')) return clone(record);
  const result = { _id: clone(record._id) };
  projection.split(' ').filter(Boolean).forEach((key) => { if (get(record, key) !== undefined) set(result, key, clone(get(record, key))); });
  return result;
};

let db;
let sequence;
let notificationsFail;
let transactionFailure;
let sessionWrites;
const media = new Map();
const session = { isolatedTestSession: true };
const reset = () => {
  sequence = 100;
  notificationsFail = false;
  transactionFailure = null;
  sessionWrites = [];
  media.clear();
  db = {
    Event: [{ _id: ids.event, title: 'Test event', status: 'approved', ownerId: ids.owner, ownerRole: 'client' }],
    EventChat: [{ _id: ids.chat, eventId: ids.event, ownerId: ids.owner, ownerRole: 'client', members: [
      { userId: ids.owner, role: 'client', joinedAt: new Date() }, { userId: ids.member, role: 'model', joinedAt: new Date() },
    ], createdAt: new Date() }],
    ChatInvitation: [{ _id: ids.invitation, chatId: ids.chat, invitedUserId: ids.other, invitedUserRole: 'model', invitedById: ids.owner, invitedByRole: 'client', status: 'pending', respondedAt: null, createdAt: new Date() }],
    ChatJoinRequest: [{ _id: ids.request, chatId: ids.chat, requestedById: ids.other, requestedByRole: 'model', status: 'pending', createdAt: new Date() }],
    ChatMessage: [], Notification: [],
    Client: [{ _id: ids.owner, name: 'Owner', approvalStatus: 'approved', password: 'PRIVATE', address: 'PRIVATE' }],
    ModelUser: [ids.member, ids.other].map((id) => ({ _id: id, fullName: equal(id, ids.member) ? 'Model .*' : 'Other model', approvalStatus: 'approved', email: 'PRIVATE', password: 'PRIVATE', idFrontImage: 'PRIVATE' })),
    Photographer: [], Agency: [],
  };
};
class Query {
  constructor(run) { this.run = run; }
  select(value) { this.projection = value; return this; }
  session(value) { this.sessionValue = value; return this; }
  lean() { return this; }
  sort(value) { this.sortValue = value; return this; }
  limit(value) { this.limitValue = value; return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      let result = this.run(this.sessionValue);
      if (Array.isArray(result)) {
        result = [...result];
        if (this.sortValue) result.sort((a, b) => {
          for (const [key, direction] of Object.entries(this.sortValue)) {
            if (equal(a[key], b[key])) continue;
            return (a[key] < b[key] ? -1 : 1) * direction;
          }
          return 0;
        });
        if (this.limitValue) result = result.slice(0, this.limitValue);
        return result.map((record) => project(record, this.projection));
      }
      return project(result, this.projection);
    }).then(resolve, reject);
  }
}
const applyUpdate = (record, update) => {
  for (const [key, value] of Object.entries(update.$set || {})) set(record, key, clone(value));
  for (const [key, value] of Object.entries(update.$inc || {})) set(record, key, (get(record, key) || 0) + value);
  for (const [key, value] of Object.entries(update.$push || {})) record[key].push(clone(value));
  for (const [key, value] of Object.entries(update.$pull || {})) record[key] = record[key].filter((entry) => !match(entry, value));
};
const models = Object.fromEntries(['Event', 'EventChat', 'ChatInvitation', 'ChatJoinRequest', 'ChatMessage', 'Notification', 'Client', 'ModelUser', 'Photographer', 'Agency'].map((name) => [name, {
  find: (filter) => new Query(() => db[name].filter((record) => match(record, filter))),
  findOne: (filter) => new Query(() => db[name].find((record) => match(record, filter)) || null),
  findById: (id) => new Query(() => db[name].find((record) => equal(record._id, id)) || null),
  findOneAndUpdate: (filter, update, options) => new Query(() => {
    if (options?.session) sessionWrites.push([name, options.session]);
    const record = db[name].find((entry) => match(entry, filter));
    if (!record) return null;
    applyUpdate(record, update);
    return record;
  }),
  updateOne: async (filter, update, options) => {
    if (options?.session) sessionWrites.push([name, options.session]);
    const record = db[name].find((entry) => match(entry, filter));
    if (!record) return { matchedCount: 0 };
    applyUpdate(record, update);
    return { matchedCount: 1 };
  },
  create: async (input, options) => {
    if (name === 'Notification' && notificationsFail) throw new Error('Simulated notification failure');
    if (options?.session) sessionWrites.push([name, options.session]);
    const records = (Array.isArray(input) ? input : [input]).map((record) => ({ _id: oid(sequence++), createdAt: new Date(), isDeleted: false, ...clone(record) }));
    db[name].push(...records);
    return Array.isArray(input) ? records : records[0];
  },
}]));
let queue = Promise.resolve();
const mockMongoose = {
  Types: mongoose.Types, isValidObjectId: mongoose.isValidObjectId, isObjectIdOrHexString: mongoose.isObjectIdOrHexString,
  connection: { readyState: 1, transaction: (work) => {
    const result = queue.then(async () => {
      if (transactionFailure) throw transactionFailure;
      const snapshot = clone(db);
      try { return await work(session); } catch (error) { db = snapshot; throw error; }
    });
    queue = result.catch(() => {});
    return result;
  } },
};
const loaded = new Map();
const load = (filename) => {
  const absolute = path.resolve(__dirname, '..', filename);
  if (loaded.has(absolute)) return loaded.get(absolute);
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === 'mongoose') return mockMongoose;
    if (specifier.includes('/models/')) return models[path.basename(specifier)];
    if (specifier === 'node:fs/promises') return { open: async (filename) => {
      const data = media.get(path.basename(filename));
      if (!data) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
      return { stat: async () => ({ size: data.length, isFile: () => true }), createReadStream: () => Readable.from(data), close: async () => {} };
    } };
    if (specifier.startsWith('.')) {
      const target = path.resolve(path.dirname(absolute), `${specifier}.js`);
      const relative = path.relative(path.resolve(__dirname, '..'), target);
      if (target.endsWith('eventChatImageService.js')) {
        const actual = require(target);
        return { ...actual,
          saveImage: async (image) => { const key = `${require('node:crypto').randomUUID()}.webp`; media.set(key, image.data); return key; },
          removeImage: async (key) => { media.delete(key); },
        };
      }
      return load(relative);
    }
    return require(specifier);
  };
  const wrapper = vm.runInThisContext(`(function(require,module,exports,__dirname){${fs.readFileSync(absolute, 'utf8')}\n})`, { filename: absolute });
  wrapper(localRequire, module, module.exports, path.dirname(absolute));
  loaded.set(absolute, module.exports);
  return module.exports;
};

const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'isolated-chat-tests-only-not-a-deployment-secret';
const app = express();
app.use(express.json());
app.use('/api/event-chats', load('routes/eventChatRoutes.js'));
let server;
let origin;
let realtime;
const clients = new Set();
const publications = new Set();
const request = async (endpoint, { user = 'owner', role, method = 'GET', body, form } = {}) => {
  const headers = {};
  if (user) headers.cookie = `modelnext_user_session=${jwt.sign({ role: role || (user === 'owner' ? 'client' : 'model'), jti: crypto.randomUUID() }, process.env.JWT_SECRET, { subject: String(ids[user]), expiresIn: '1h' })}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${origin}/api/event-chats${endpoint}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.arrayBuffer();
  return { status: response.status, data, headers: response.headers };
};
const pathFor = (tail = '') => `/${ids.chat}${tail}`;
const respondInvitation = (action, user = 'other', role) => request(`/invitations/${ids.invitation}/respond`, { user, role, method: 'PATCH', body: { action } });
const reviewRequest = (action, user = 'owner') => request(`/join-requests/${ids.request}/respond`, { user, method: 'PATCH', body: { action } });

test.before(async () => {
  server = http.createServer(app);
  realtime = load('services/eventChatRealtime.js').createEventChatRealtime(server, {
    isAllowedOrigin: (value) => !value || value === 'http://localhost:3000',
  });
  const publish = realtime.publish;
  realtime.publish = (message) => {
    const work = publish(message);
    publications.add(work);
    work.finally(() => publications.delete(work)).catch(() => {});
    return work;
  };
  app.set('eventChatRealtime', realtime);
  app.use('/api/auth', load('routes/authRoutes.js').router);
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(reset);
test.afterEach(async () => {
  await Promise.allSettled([...publications]);
  for (const client of clients) client.disconnect();
  clients.clear();
  await until(() => realtime.io.of('/').sockets.size === 0);
});
test.after(async () => {
  await realtime.close();
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  assert.equal(mongoose.connection.readyState, 0);
});

test('protected routes reject missing authentication and pending accounts', async () => {
  assert.equal((await request('/mine', { user: null })).status, 401);
  db.Client[0].approvalStatus = 'pending';
  assert.equal((await request('/mine')).status, 403);
});
test('same ObjectId with another role cannot impersonate a chat member', async () => {
  db.Photographer.push({ _id: ids.member, name: 'Different account', approvalStatus: 'approved' });
  assert.equal((await request(pathFor('/messages'), { user: 'member', role: 'photographer' })).status, 403);
});
test('nonmembers cannot read chats, members, text, or private images', async () => {
  for (const endpoint of ['', '/members', '/messages', `/messages/${oid(99)}/image`]) assert.equal((await request(pathFor(endpoint), { user: 'other' })).status, 403);
});
test('deleted and rejected events deny chat access', async () => {
  db.Event[0].status = 'rejected';
  assert.equal((await request(pathFor())).status, 403);
  db.Event = [];
  assert.equal((await request(pathFor('/messages'))).status, 404);
});
test('owner-only discovery returns public names and escapes regex search', async () => {
  assert.equal((await request(pathFor('/users?role=model'), { user: 'member' })).status, 403);
  const response = await request(pathFor('/users?role=model&q=' + encodeURIComponent('.*')));
  assert.equal(response.status, 200);
  assert.equal(response.data.users.length, 1);
  assert.equal(response.data.users[0].name, 'Model .*');
  assert.doesNotMatch(JSON.stringify(response.data), /PRIVATE|email|password|idFrontImage/);
});
test('invalid role, pagination, and IDs return JSON 400', async () => {
  for (const endpoint of [pathFor('/users?role=admin'), '/mine?limit=101', '/mine?before=bad', '/bad/members']) assert.equal((await request(endpoint)).status, 400);
});
test('received invitations and own join requests are account-scoped', async () => {
  assert.equal((await request('/invitations/mine')).data.invitations.length, 0);
  assert.equal((await request('/invitations/mine', { user: 'other' })).data.invitations.length, 1);
  assert.equal((await request('/join-requests/mine', { user: 'member' })).data.requests.length, 0);
});
test('nonmembers get only event chat availability and their own request state', async () => {
  const response = await request(`/events/${ids.event}/chat`, { user: 'other' });
  assert.equal(response.status, 200);
  assert.equal(response.data.chat.isMember, false);
  assert.equal(response.data.request.status, 'pending');
  assert.equal('members' in response.data.chat, false);
});
test('accept requires recipient ID and role, then atomically adds one member', async () => {
  assert.equal((await respondInvitation('accept', 'member')).status, 403);
  const response = await respondInvitation('accept');
  assert.equal(response.status, 200);
  assert.equal(db.ChatInvitation[0].status, 'accepted');
  assert.ok(db.ChatInvitation[0].respondedAt instanceof Date);
  assert.equal(db.EventChat[0].members.filter((member) => equal(member.userId, ids.other)).length, 1);
  assert.equal((await respondInvitation('accept')).status, 409);
  assert.ok(sessionWrites.some(([name]) => name === 'Event'));
  assert.ok(sessionWrites.every(([, value]) => value === session));
});
test('simultaneous invitation responses produce one completed response', async () => {
  const responses = await Promise.all([respondInvitation('accept'), respondInvitation('decline')]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(db.EventChat[0].members.filter((member) => equal(member.userId, ids.other)).length, db.ChatInvitation[0].status === 'accepted' ? 1 : 0);
});
test('decline leaves membership unchanged', async () => {
  assert.equal((await respondInvitation('decline')).status, 200);
  assert.equal(db.ChatInvitation[0].status, 'declined');
  assert.equal(db.EventChat[0].members.length, 2);
});
test('transaction failure rolls back invitation and membership', async () => {
  notificationsFail = true;
  assert.equal((await respondInvitation('accept')).status, 500);
  assert.equal(db.ChatInvitation[0].status, 'pending');
  assert.equal(db.EventChat[0].members.length, 2);
});
test('standalone transaction errors fail closed without changes', async () => {
  transactionFailure = Object.assign(new Error('Unsupported'), { code: 20 });
  assert.equal((await reviewRequest('approve')).status, 503);
  assert.equal(db.ChatJoinRequest[0].status, 'pending');
});
test('join requests reject members and duplicates; creation does not add membership', async () => {
  assert.equal((await request(pathFor('/join-requests'), { user: 'member', method: 'POST', body: {} })).status, 409);
  assert.equal((await request(pathFor('/join-requests'), { user: 'other', method: 'POST', body: {} })).status, 409);
  db.ChatJoinRequest = [];
  assert.equal((await request(pathFor('/join-requests'), { user: 'other', method: 'POST', body: { requestedById: String(ids.owner) } })).status, 201);
  assert.ok(equal(db.ChatJoinRequest[0].requestedById, ids.other));
  assert.equal(db.EventChat[0].members.length, 2);
});
test('only owner reviews requests, approval deduplicates membership', async () => {
  assert.equal((await reviewRequest('approve', 'member')).status, 403);
  assert.equal((await respondInvitation('accept')).status, 200);
  assert.equal((await reviewRequest('approve')).status, 200);
  assert.equal(db.EventChat[0].members.filter((member) => equal(member.userId, ids.other)).length, 1);
  assert.equal((await reviewRequest('reject')).status, 409);
});
test('reject leaves membership unchanged and revoked requester cannot be approved', async () => {
  db.ModelUser[1].approvalStatus = 'rejected';
  assert.equal((await reviewRequest('approve')).status, 403);
  assert.equal((await reviewRequest('reject')).status, 200);
  assert.equal(db.EventChat[0].members.length, 2);
});
test('member removal blocks subsequent access and cannot remove owner', async () => {
  assert.equal((await request(pathFor(`/members/client/${ids.owner}`), { method: 'DELETE' })).status, 409);
  assert.equal((await request(pathFor(`/members/model/${ids.member}`), { method: 'DELETE' })).status, 204);
  assert.equal((await request(pathFor('/messages'), { user: 'member' })).status, 403);
});
test('text rejects invalid input and never trusts a submitted sender', async () => {
  for (const text of ['', ' ', 'x'.repeat(5001), { malicious: true }]) assert.equal((await request(pathFor('/messages'), { method: 'POST', body: { text, clientMessageId: 'test-key-1' } })).status, 400);
  const response = await request(pathFor('/messages'), { method: 'POST', body: { text: 'hello', clientMessageId: 'test-key-1', senderId: String(ids.other), senderRole: 'model' } });
  assert.equal(response.status, 201);
  assert.equal(response.data.message.sender.id, String(ids.owner));
  assert.equal(response.data.message.sender.role, 'client');
});
test('message retries return the original message and reject changed payload', async () => {
  const body = { text: 'hello', clientMessageId: 'test-key-1' };
  const first = await request(pathFor('/messages'), { method: 'POST', body });
  const retry = await request(pathFor('/messages'), { method: 'POST', body });
  assert.equal(retry.status, 200);
  assert.equal(first.data.message.id, retry.data.message.id);
  assert.equal(db.ChatMessage.length, 1);
  assert.equal((await request(pathFor('/messages'), { method: 'POST', body: { ...body, text: 'changed' } })).status, 409);
});
test('history pagination is stable for equal timestamps and never returns private fields', async () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  db.ChatMessage = [1, 2, 3].map((n) => ({ _id: oid(100 + n), chatId: ids.chat, senderId: ids.member, senderRole: 'model', messageType: 'text', text: String(n), createdAt, isDeleted: false, image: { storageKey: 'PRIVATE' } }));
  const first = await request(pathFor('/messages?limit=2'));
  assert.deepEqual(first.data.messages.map((message) => message.text), ['2', '3']);
  const second = await request(pathFor('/messages?limit=2&before=' + first.data.nextCursor));
  assert.deepEqual(second.data.messages.map((message) => message.text), ['1']);
  assert.equal(second.data.nextCursor, null);
  assert.doesNotMatch(JSON.stringify(first.data), /PRIVATE|storageKey|password/);
});
test('image decoder accepts JPEG/PNG/WebP and rejects executable/corrupt/SVG payloads', async () => {
  const { normalizeImage } = require('../services/eventChatImageService');
  for (const format of ['jpeg', 'png', 'webp']) {
    const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).toFormat(format).toBuffer();
    const result = await normalizeImage(buffer);
    assert.equal((await sharp(result.data).metadata()).format, 'webp');
    assert.equal(result.mimeType, 'image/webp');
  }
  for (const buffer of [Buffer.from('MZ executable'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), Buffer.from([137, 80, 78, 71])]) await assert.rejects(normalizeImage(buffer), (error) => error.chatStatus === 415);
});
test('valid image upload returns only protected URL; other chat IDs and removed members are denied', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
  const form = new FormData();
  form.set('clientMessageId', 'test-image-1'); form.set('image', new Blob([png], { type: 'image/png' }), 'picture.png');
  const response = await request(pathFor('/messages/images'), { method: 'POST', form });
  assert.equal(response.status, 201);
  assert.doesNotMatch(JSON.stringify(response.data), /storageKey|digest|private\/|uploads\//);
  const image = await request(pathFor(`/messages/${response.data.message.id}/image`));
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('cache-control'), 'private, no-store');
  assert.equal(image.headers.get('content-type'), 'image/webp');
  db.EventChat[0].members = [];
  assert.equal((await request(pathFor(`/messages/${response.data.message.id}/image`))).status, 403);
});
test('image upload limit rejects oversized files without storing anything', async () => {
  const form = new FormData(); form.set('clientMessageId', 'test-image-2');
  form.set('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
  assert.equal((await request(pathFor('/messages/images'), { method: 'POST', form })).status, 413);
  assert.equal(media.size, 0);
  assert.equal(db.ChatMessage.length, 0);
});
test('actual message schema validates empty text and defines scoped retry index', async () => {
  const ChatMessage = require('../models/ChatMessage');
  await assert.rejects(new ChatMessage({ chatId: ids.chat, senderId: ids.owner, senderRole: 'client', messageType: 'text', text: ' ' }).validate());
  const indexes = ChatMessage.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.clientMessageId === 1 && options.unique && options.partialFilterExpression));
});
test('original create and invite endpoints preserve owner and duplicate protections', async () => {
  assert.equal((await request(`/events/${ids.event}`, { method: 'POST', body: {} })).status, 409);
  assert.equal((await request(`/events/${ids.event}`, { user: 'member', method: 'POST', body: {} })).status, 403);
  db.ChatInvitation = [];
  const body = { invitedUserId: String(ids.other), invitedUserRole: 'model' };
  assert.equal((await request(pathFor('/invitations'), { user: 'member', method: 'POST', body })).status, 403);
  assert.equal((await request(pathFor('/invitations'), { method: 'POST', body })).status, 201);
  assert.equal(db.EventChat[0].members.length, 2);
  assert.equal(db.ChatInvitation[0].status, 'pending');
  assert.equal((await request(pathFor('/invitations'), { method: 'POST', body })).status, 409);
});
test('new chat creation keeps the owner as its first member', async () => {
  db.EventChat = [];
  const response = await request(`/events/${ids.event}`, { method: 'POST', body: {} });
  assert.equal(response.status, 201);
  assert.equal(response.data.chat.members.length, 1);
  assert.equal(response.data.chat.members[0].userId, String(ids.owner));
});
test('all four approved account roles are eligible for invitation', async () => {
  const cases = [['model', 'ModelUser'], ['photographer', 'Photographer'], ['agency', 'Agency'], ['client', 'Client']];
  for (const [role, model] of cases) {
    if (!db[model].some((account) => equal(account._id, ids.other))) db[model].push({ _id: ids.other, name: 'Approved account', approvalStatus: 'approved' });
    const response = await request(pathFor('/invitations'), { method: 'POST', body: { invitedUserId: String(ids.other), invitedUserRole: role } });
    assert.equal(response.status, role === 'model' ? 409 : 201);
  }
});
test('sender can read another chat but cannot fetch an image through the wrong chat URL', async () => {
  const secondChat = oid(21);
  db.EventChat.push({ ...clone(db.EventChat[0]), _id: secondChat });
  db.ChatMessage.push({ _id: oid(90), chatId: ids.chat, messageType: 'image', isDeleted: false, image: { storageKey: '00000000-0000-4000-8000-000000000000.webp' } });
  assert.equal((await request(`/${secondChat}/messages/${oid(90)}/image`)).status, 404);
});
test('image retry keeps one file and failed transactions clean their new file', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'blue' } }).png().toBuffer();
  const send = (key) => {
    const form = new FormData(); form.set('clientMessageId', key); form.set('image', new Blob([png]), 'ignored.exe');
    return request(pathFor('/messages/images'), { method: 'POST', form });
  };
  assert.equal((await send('image-retry-1')).status, 201);
  assert.equal((await send('image-retry-1')).status, 200);
  assert.equal(media.size, 1);
  assert.equal(db.ChatMessage.length, 1);
  transactionFailure = Object.assign(new Error('Unavailable transaction'), { code: 20 });
  assert.equal((await send('image-retry-2')).status, 503);
  assert.equal(media.size, 1);
  assert.equal(db.ChatMessage.length, 1);
});
test('invitation response rejects wrong action and recipient role, including shared IDs', async () => {
  assert.equal((await respondInvitation('approve')).status, 400);
  db.Photographer.push({ _id: ids.other, name: 'Another account', approvalStatus: 'approved' });
  assert.equal((await respondInvitation('accept', 'other', 'photographer')).status, 403);
});
// Real Socket.IO transports; fake MongoDB only. No application database is used.
const until = async (condition, timeout = 2500) => {
  const deadline = Date.now() + timeout;
  while (!condition()) { if (Date.now() >= deadline) throw new Error('Timed out waiting for test condition'); await new Promise((resolve) => setTimeout(resolve, 5)); }
};
const cookieFor = (user = 'owner', role, options = {}) => `modelnext_user_session=${jwt.sign(
  { role: role || (user === 'owner' ? 'client' : 'model'), jti: crypto.randomUUID() },
  options.secret || process.env.JWT_SECRET,
  { subject: String(ids[user]), expiresIn: options.expiresIn || '1h' }
)}`;
const connectClient = async ({ user = 'owner', role, cookie = cookieFor(user, role), originHeader = 'http://localhost:3000', auth, transports = ['websocket'] } = {}) => {
  const client = socketClient(origin, { autoConnect: false, reconnection: false, forceNew: true, timeout: 2000, transports,
    withCredentials: true, extraHeaders: { ...(cookie ? { cookie } : {}), Origin: originHeader }, auth,
  });
  clients.add(client);
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
    client.connect();
  });
  return client;
};
const ack = (client, event, payload) => new Promise((resolve, reject) => {
  client.timeout(2500).emit(event, payload, (error, response) => error ? reject(error) : resolve(response));
});
const join = (client) => ack(client, 'chat:join', { chatId: String(ids.chat) });
const send = (client, key = crypto.randomUUID(), text = 'Socket message') => ack(client, 'chat:send', { chatId: String(ids.chat), text, clientMessageId: key });
const receivedMessages = (client) => {
  const messages = [];
  client.on('chat:message', (packet) => messages.push(packet.message));
  return messages;
};

test('socket handshakes reject missing, malformed, expired, and forged cookies', async () => {
  for (const cookie of ['', 'modelnext_user_session=%ZZ', cookieFor('owner', undefined, { expiresIn: '-1s' }), cookieFor('owner', undefined, { secret: 'incorrect-secret' })]) {
    await assert.rejects(connectClient({ cookie }), (error) => error.data?.status === 401);
  }
  assert.equal(realtime.io.of('/').sockets.size, 0);
});
test('socket ignores auth tokens/user claims and rejects nonapproved accounts', async () => {
  await assert.rejects(connectClient({ cookie: '', auth: { token: cookieFor(), userId: String(ids.owner), role: 'client' } }), (error) => error.data?.status === 401);
  db.ModelUser[0].approvalStatus = 'pending';
  await assert.rejects(connectClient({ user: 'member' }), (error) => error.data?.status === 403);
  db.ModelUser = [];
  await assert.rejects(connectClient({ user: 'member' }), (error) => error.data?.status === 401);
});
test('shared origin policy rejects WebSocket and polling handshakes from other origins', async () => {
  for (const transports of [['websocket'], ['polling']]) await assert.rejects(connectClient({ originHeader: 'https://untrusted.example', transports }));
  assert.equal(realtime.io.of('/').sockets.size, 0);
});
test('authenticated polling transport works on the same HTTP listener as REST', async () => {
  const client = await connectClient({ user: 'member', transports: ['polling'] });
  assert.equal((await join(client)).ok, true);
  assert.equal((await request(pathFor('/messages'))).status, 200);
  assert.equal(client.io.engine.transport.name, 'polling');
});
test('socket rooms require approved event membership and both account ID and role', async () => {
  const outsider = await connectClient({ user: 'other' });
  assert.equal((await join(outsider)).status, 403);
  db.Photographer.push({ _id: ids.member, name: 'Different role', approvalStatus: 'approved' });
  const otherRole = await connectClient({ user: 'member', role: 'photographer' });
  assert.equal((await join(otherRole)).status, 403);
  const member = await connectClient({ user: 'member' });
  db.Event[0].status = 'rejected';
  assert.equal((await join(member)).status, 403);
  db.Event = [];
  assert.equal((await join(member)).status, 404);
});
test('socket payloads reject impersonation, arbitrary rooms, and extra arguments', async () => {
  const client = await connectClient();
  assert.equal((await ack(client, 'chat:join', { chatId: String(ids.chat), role: 'model', userId: String(ids.member) })).status, 400);
  assert.equal((await ack(client, 'chat:join', { chatId: client.id })).status, 400);
  assert.equal((await ack(client, 'join', { room: 'anything' })).status, 400);
  const response = await new Promise((resolve) => client.emit('chat:join', { chatId: String(ids.chat) }, 'extra', resolve));
  assert.equal(response.status, 400);
  assert.equal((await send(client)).status, 403);
  assert.equal(db.ChatMessage.length, 0);
});
test('socket text persistence precedes delivery and only authorized room members receive it', async () => {
  const owner = await connectClient();
  const member = await connectClient({ user: 'member' });
  const outsider = await connectClient({ user: 'other' });
  await join(owner); await join(member);
  assert.equal((await join(outsider)).status, 403);
  const mine = receivedMessages(owner); const theirs = receivedMessages(member); const blocked = receivedMessages(outsider);
  let existedAtDelivery = false;
  member.on('chat:message', ({ message }) => { existedAtDelivery = db.ChatMessage.some((record) => equal(record._id, message.id)); });
  const result = await send(owner);
  assert.equal(result.ok, true);
  await until(() => theirs.length === 1 && mine.length === 1);
  assert.equal(existedAtDelivery, true);
  assert.equal(blocked.length, 0);
  assert.equal(result.message.sender.id, String(ids.owner));
  assert.doesNotMatch(JSON.stringify(theirs), /PRIVATE|password|cookie|storageKey|sessionKey/);
});
test('socket validation and same-key retries reuse REST persistence without duplicate broadcasts', async () => {
  const owner = await connectClient(); const member = await connectClient({ user: 'member' });
  await join(owner); await join(member);
  const messages = receivedMessages(member);
  assert.equal((await send(owner, 'socket-key-1', ' ')).status, 400);
  assert.equal((await send(owner, 'socket-key-1', 'x'.repeat(5001))).status, 400);
  const first = await send(owner, 'socket-key-1', 'Hello');
  const replay = await send(owner, 'socket-key-1', 'Hello');
  assert.equal(replay.ok, true); assert.equal(replay.replay, true);
  assert.equal(first.message.id, replay.message.id);
  assert.equal((await send(owner, 'socket-key-1', 'Different')).status, 409);
  await until(() => messages.length === 1);
  assert.equal(db.ChatMessage.length, 1);
});
test('simultaneous sends from two tabs create one message for the same retry key', async () => {
  const first = await connectClient(); const second = await connectClient();
  await join(first); await join(second);
  const messages = receivedMessages(first);
  const responses = await Promise.all([send(first, 'two-tabs-key'), send(second, 'two-tabs-key')]);
  assert.equal(responses.filter((response) => response.replay === false).length, 1);
  assert.equal(responses.filter((response) => response.replay === true).length, 1);
  await until(() => messages.length === 1);
  assert.equal(db.ChatMessage.length, 1);
});
test('REST text and image sends publish through the same authorized live-delivery path', async () => {
  const member = await connectClient({ user: 'member' }); await join(member);
  const messages = receivedMessages(member);
  assert.equal((await request(pathFor('/messages'), { method: 'POST', body: { text: 'REST hello', clientMessageId: 'rest-live-key' } })).status, 201);
  await until(() => messages.length === 1);
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'green' } }).png().toBuffer();
  const form = new FormData(); form.set('clientMessageId', 'rest-live-image'); form.set('image', new Blob([png]), 'safe.png');
  assert.equal((await request(pathFor('/messages/images'), { method: 'POST', form })).status, 201);
  await until(() => messages.length === 2);
  assert.equal(messages[1].messageType, 'image');
  assert.match(messages[1].image.url, /^\/api\/event-chats\//);
});
test('failed persistence never broadcasts a socket message', async () => {
  const owner = await connectClient(); const member = await connectClient({ user: 'member' });
  await join(owner); await join(member);
  const messages = receivedMessages(member);
  transactionFailure = Object.assign(new Error('No transactions'), { code: 20 });
  const response = await send(owner);
  assert.equal(response.ok, false); assert.equal(response.status, 503);
  assert.equal(messages.length, 0); assert.equal(db.ChatMessage.length, 0);
});
test('stale room membership cannot receive a new message after removal', async () => {
  const owner = await connectClient(); const member = await connectClient({ user: 'member' });
  await join(owner); await join(member);
  const blocked = receivedMessages(member);
  db.EventChat[0].members = db.EventChat[0].members.filter((entry) => !equal(entry.userId, ids.member));
  const response = await send(owner);
  assert.equal(response.ok, true);
  await until(() => !realtime.io.of('/').sockets.get(member.id)?.rooms.has(`event-chat:${ids.chat}`));
  assert.equal(blocked.length, 0);
});
test('revoked or deleted accounts are disconnected before private delivery', async () => {
  const owner = await connectClient(); const member = await connectClient({ user: 'member' });
  await join(owner); await join(member);
  const blocked = receivedMessages(member);
  db.ModelUser[0].approvalStatus = 'rejected';
  assert.equal((await send(owner)).ok, true);
  await until(() => !member.connected);
  assert.equal(blocked.length, 0);
});
test('idle authorization sweep evicts rooms after event rejection and account revocation', async () => {
  const member = await connectClient({ user: 'member' }); await join(member);
  const revoked = []; member.on('chat:access_revoked', (event) => revoked.push(event));
  db.Event[0].status = 'rejected';
  await realtime.revalidate();
  await until(() => revoked.length > 0);
  assert.equal(revoked[0].chatId, String(ids.chat));
  assert.equal(realtime.io.of('/').sockets.get(member.id).rooms.has(`event-chat:${ids.chat}`), false);
  db.ModelUser = [];
  await realtime.revalidate();
  await until(() => !member.connected);
});
test('owner REST removal immediately evicts the affected member socket', async () => {
  const member = await connectClient({ user: 'member' }); await join(member);
  const revoked = []; member.on('chat:access_revoked', (event) => revoked.push(event));
  assert.equal((await request(pathFor(`/members/model/${ids.member}`), { method: 'DELETE' })).status, 204);
  await until(() => revoked.length > 0);
  assert.equal((await join(member)).status, 403);
});
test('logout closes the current socket session and rejects reuse on reconnect', async () => {
  const cookie = cookieFor();
  const client = await connectClient({ cookie }); await join(client);
  const response = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { cookie } });
  assert.equal(response.status, 204);
  await until(() => !client.connected);
  await assert.rejects(connectClient({ cookie }), (error) => error.data?.status === 401);
});
test('reconnect never restores private rooms automatically; history remains available', async () => {
  const cookie = cookieFor();
  const first = await connectClient({ cookie }); await join(first);
  assert.equal((await send(first, 'reconnect-key')).ok, true);
  first.disconnect();
  const second = await connectClient({ cookie });
  assert.equal((await send(second)).status, 403);
  assert.equal((await join(second)).ok, true);
  const replay = await send(second, 'reconnect-key');
  assert.equal(replay.replay, true);
  assert.equal((await request(pathFor('/messages'))).data.messages.length, 1);
});
test('leave stops live delivery and acknowledgement is required for socket mutations', async () => {
  const owner = await connectClient(); const member = await connectClient({ user: 'member' });
  await join(owner); await join(member);
  const messages = receivedMessages(member);
  assert.equal((await ack(member, 'chat:leave', { chatId: String(ids.chat) })).ok, true);
  assert.equal((await send(owner)).ok, true);
  assert.equal(messages.length, 0);
  const errors = []; owner.on('chat:error', (event) => errors.push(event));
  owner.emit('chat:send', { chatId: String(ids.chat), text: 'No ack', clientMessageId: 'no-ack-key' });
  await until(() => errors.length === 1);
  assert.equal(errors[0].status, 400);
  assert.equal(db.ChatMessage.length, 1);
});
test('socket session expiry disconnects an idle client', async () => {
  const client = await connectClient({ cookie: cookieFor('owner', undefined, { expiresIn: '2s' }) });
  await join(client);
  await until(() => !client.connected, 3000);
});
test('revoked events block outbound private packets even while sockets remain in a stale room', async () => {
  const owner = await connectClient(); const member = await connectClient({ user: 'member' });
  await join(owner); await join(member);
  const mine = receivedMessages(owner); const theirs = receivedMessages(member);
  db.Event[0].status = 'rejected';
  // Server-only delivery hook: model a persisted message awaiting publication.
  await realtime.publish({ id: String(oid(99)), chatId: String(ids.chat), text: 'Must not be emitted' });
  assert.equal(mine.length, 0); assert.equal(theirs.length, 0);
  assert.equal(realtime.io.of('/').sockets.get(owner.id).rooms.has(`event-chat:${ids.chat}`), false);
});
test('the per-account socket event limit prevents unbounded repeated actions', async () => {
  const client = await connectClient();
  for (let i = 0; i < 60; i += 1) assert.equal((await join(client)).ok, true);
  assert.equal((await join(client)).status, 429);
  assert.equal(db.ChatMessage.length, 0);
});
test('delivery fails closed during database authentication failures', async () => {
  const member = await connectClient({ user: 'member' }); await join(member);
  const messages = receivedMessages(member);
  // Removing the account models a database lookup that can no longer authorize it.
  db.ModelUser = [];
  await realtime.publish({ id: String(oid(99)), chatId: String(ids.chat), text: 'Must not be emitted' });
  await until(() => !member.connected);
  assert.equal(messages.length, 0);
});
test('socket sender fields are rejected and do not change message ownership', async () => {
  const owner = await connectClient(); await join(owner);
  const response = await ack(owner, 'chat:send', { chatId: String(ids.chat), text: 'Spoof', clientMessageId: 'spoof-key', senderId: String(ids.member), senderRole: 'model' });
  assert.equal(response.status, 400);
  assert.equal(db.ChatMessage.length, 0);
});
test('regular-user sessions have unique IDs even for immediate consecutive logins', async () => {
  const { issueUserSession } = load('utils/sessionCookies.js');
  const first = issueUserSession({ _id: ids.owner }, 'client');
  const second = issueUserSession({ _id: ids.owner }, 'client');
  assert.notEqual(first, second);
  const firstClaims = jwt.verify(first, process.env.JWT_SECRET);
  const secondClaims = jwt.verify(second, process.env.JWT_SECRET);
  assert.notEqual(firstClaims.jti, secondClaims.jti);
  assert.equal(firstClaims.sub, String(ids.owner));
  assert.equal(firstClaims.role, 'client');
});
test('previously issued user cookies without a jti remain compatible', async () => {
  const token = jwt.sign({ role: 'client' }, process.env.JWT_SECRET, { subject: String(ids.owner), expiresIn: '1h' });
  const client = await connectClient({ cookie: `modelnext_user_session=${token}` });
  assert.equal((await join(client)).ok, true);
});