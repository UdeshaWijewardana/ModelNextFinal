# Phase 3 — Secure Socket.IO event chat

The existing Express application and Socket.IO share one `http.createServer(app)`
listener and the existing configured port. REST routes and public profile uploads
are unchanged. No React components or frontend dependencies were modified.

Dependencies: `socket.io@4.8.4` is a backend runtime dependency;
`socket.io-client@4.8.4` is a backend development dependency for isolated tests.
The browser test below loads the client bundle served by the backend itself.

## Protocol

Connect to the backend origin, default local example `http://localhost:5000`,
with `withCredentials: true`. The standard transport path is `/socket.io/`.
Authentication uses only the existing HTTP-only `modelnext_user_session` cookie.
Do not put tokens, user IDs, or roles into socket `auth`, query parameters, or
chat payloads. Client claims never authorize a connection or message.

| Direction | Event | Payload | Acknowledgement |
| --- | --- | --- | --- |
| Client → server | `chat:join` | `{ chatId }` | `{ ok: true, chatId }` |
| Client → server | `chat:leave` | `{ chatId }` | `{ ok: true, chatId }` |
| Client → server | `chat:send` | `{ chatId, text, clientMessageId }` | `{ ok: true, message, replay }` |
| Server → client | `chat:message` | `{ message }` | None |
| Server → client | `chat:access_revoked` | `{ ok: false, status, error, chatId? }` | None |
| Server → client | `chat:error` | `{ ok: false, status, error }` | None |

Client events require exactly one payload object and an acknowledgement callback.
Unknown events, extra fields (including sender identity), and extra arguments are
rejected. Errors use `{ ok: false, status, error }`; `status` is a numeric result
code, not an HTTP response. Connection failures use Socket.IO `connect_error`
with a safe `.message` and `.data.status`.

`message` is the existing REST-safe DTO: `id`, `chatId`, `clientMessageId`,
`sender: { id, role, name }`, `messageType`, `text`, `createdAt`, and optional
protected image URL/metadata. No tokens, contacts, identity evidence, internal
storage keys, or local filesystem paths are included.

Text and retry-key limits are identical to REST: nonempty trimmed text with a
maximum input length of 5,000 characters, and a retry key of 8–100 letters,
digits, underscores, or hyphens. Generate one key per intended message and reuse
it unchanged after timeouts. Repeating the same payload returns the original
message with `replay: true`; changing the payload for that key returns 409.

Images continue to upload through the protected multipart REST API. Successful
REST text and image sends publish `chat:message` through the same guarded live
path. Images are not accepted as Socket.IO binary uploads.

## Authentication and authorization

`eventChatSocketAuth` adapts the Socket.IO HTTP request to the existing
`requireUser` middleware. Cookie parsing, JWT signature/expiry, role validation,
account existence, database availability, and approval checks stay centralized.
Old valid JWTs remain supported. New regular-user JWTs now include a random `jti`
so separate logins cannot accidentally issue identical session tokens in the same
second. The cookie name, options, session duration, and frontend flow are unchanged.

Rooms are generated only by the server as `event-chat:<normalized ObjectId>`.
Joining requires current membership with both ID and role and an approved event.
Ownership alone does not bypass message membership. Sending requires joining the
room and passes through the same transactional persistence service as REST.

Room occupancy is never sufficient for message delivery. Every recipient's
original cookie is reverified and their account, membership, and event approval
are checked against MongoDB before each private emission. Failed checks evict the
room or disconnect the socket; there is no permissive authorization cache.
The shared CORS predicate is also enforced via `allowRequest` for WebSocket
handshakes, because browser CORS headers alone do not block WebSockets.

Idle connections are revalidated every 15 seconds; JWT expiry also has a dedicated
timer. REST member removal evicts matching ID/role connections immediately.
Logout disconnects sockets for that exact signed session and records a bounded,
process-local hash revocation until expiry. Hashes and JWTs are never sent to
clients. This socket revocation layer does not change existing stateless REST
JWT validation. It is not persistent or shared across backend processes.

Authorization checks cannot retract packets already enqueued or operations
already authorized before revocation. Subsequent actions/deliveries revalidate;
removed/revoked users cannot rely on stale rooms to receive new messages.

## Persistence, retries, ordering, and reconnects

The shared service validates text, performs the existing transaction and retry
lookup, and serializes safe output. Publication happens only after transaction
commit. Failed persistence never publishes. Both transports use the existing
scoped partial unique retry index and guarded transactional chat access.

Retries never create a second message or trigger a second broadcast. Clients
must still deduplicate by `message.id`, because an originating client may see
both an event and its acknowledgement, or recover the same record from history.

Socket.IO connection-state recovery is deliberately disabled: private packet
buffers and stale rooms are not restored after reconnect. Each connection must
reauthenticate, explicitly rejoin, and refetch REST history. A reconnect listener
should rejoin only its selected chats and retrieve pages until it reaches a
known message. Merge/deduplicate by ID and sort by `createdAt`, then ID, matching
the REST history order. A server-initiated disconnect requires an explicit new
connect after the user signs in again or the service becomes available.

Live delivery is best effort. MongoDB history is authoritative. Process crashes,
queue overload, or a network disconnect can leave a committed message without a
live event; refresh/reconnect/history reconciliation recovers it. An uncertain
commit returns 503; retry the identical key rather than creating a new one.

Publication queues preserve publication order within each chat. Concurrent
commits may finish serialization in a different order; clients should use the
persisted timestamp/ID order rather than assuming event arrival order.

Reference behavior: [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
and [connection-state recovery](https://socket.io/docs/v4/connection-state-recovery/).

## Limits and deployment scope

- 32 KiB maximum incoming Socket.IO packet.
- 60 client events per account per minute across that account's active sockets.
- At most two queued/running events per socket; join/leave/send are serialized.
- Ten active sockets per account, 1,000 active sockets per backend process.
- Twenty chat subscriptions per socket; 100 pending namespace authentications.
- At most 100 queued live deliveries per chat and 1,000 active chat queues.
- Socket logout revocations are capped at 10,000 entries. Saturation fails socket
  authentication closed until the untracked session expires, rather than evicting
  a still-valid revocation and accidentally authorizing it.

This implementation uses one backend process and the default in-memory adapter.
A multi-instance deployment needs a shared adapter, session revocation state,
shared limits, and authorization-aware fan-out across workers. Do not assume
that REST sends on one worker reach sockets on another worker. Per-recipient
checks deliberately trade database reads for privacy and need load testing.

Use HTTPS/WSS in production and configure the existing explicit origin settings.
MongoDB transaction/index and private image storage requirements from Phase 2
still apply. Existing dependency audit findings remain outside this change.

## Isolated tests

From the project root:

```powershell
node --test server/test/testEventChatBackend.js
```

The suite uses real Socket.IO server/client WebSocket and polling transports,
actual cookie/JWT middleware, mock in-memory MongoDB models/transactions, and
memory-only image storage. It does not load `.env`, connect to MongoDB, or change
existing development records. Transaction tests verify application behavior;
they do not replace replica-set integration/rollback tests.

Coverage includes missing/malformed/expired/forged sessions, unapproved/deleted
accounts, rejected origins, ID/role collisions, arbitrary-room and impersonation
attempts, persistence-before-delivery, shared REST broadcasts, retry deduplication,
failed persistence, stale-room revocation, logout, expiry, reconnect/rejoin,
leaving rooms, and request limits, alongside all Phase 2 regression tests.

## Manual test with two authenticated users

Use two separate browser profiles or one normal and one incognito window. Two
ordinary tabs share cookies and are not independent signed-in users.

1. Restart the backend normally after reviewing the changes. Do not start a second
   server on another port. Use a transaction-capable development MongoDB deployment.
2. Sign in each profile through the existing frontend as a different approved
   account that is already a member of the same approved event chat. Choose an
   existing chat intentionally; these instructions do not auto-accept invitations
   or change membership. Use `/api/event-chats/mine` to inspect accessible chats.
3. In each profile's frontend console, run the following, replacing the chat ID:

```js
const backend = `http://${location.hostname}:5000`;
const chatId = 'EXISTING_CHAT_ID';

if (!window.io) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${backend}/socket.io/socket.io.js`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

window.chatSocket?.disconnect();
window.chatSocket = io(backend, {
  withCredentials: true,
  autoConnect: false,
  reconnection: true,
});
const emitChat = (event, payload) => new Promise((resolve, reject) => {
  chatSocket.timeout(10000).emit(event, payload, (error, response) => {
    if (error) reject(error); else resolve(response);
  });
});
const seen = new Set();
chatSocket.on('chat:message', ({ message }) => {
  if (seen.has(message.id)) return;
  seen.add(message.id);
  console.log('New message:', message);
});
chatSocket.on('chat:access_revoked', (result) => console.log('Access ended:', result));
chatSocket.on('chat:error', (result) => console.log('Chat error:', result));
chatSocket.on('connect_error', (error) => console.log(error.message, error.data?.status));
chatSocket.on('disconnect', (reason) => console.log('Disconnected:', reason));
chatSocket.on('connect', async () => {
  try {
    const joined = await emitChat('chat:join', { chatId });
    console.log('Join:', joined);
    if (!joined.ok) return;
    const response = await fetch(`${backend}/api/event-chats/${chatId}/messages?limit=30`, {
      credentials: 'include',
    });
    const history = await response.json();
    console.log('History:', response.status, history);
  } catch (error) { console.log(error.message); }
});
chatSocket.connect();
```

Use your configured HTTPS backend origin instead of the local example when
applicable. No session cookie needs to be read from JavaScript.

4. After both profiles report a successful join, send from either profile:

```js
// This intentionally creates one development message.
window.lastChatSend = {
  chatId,
  text: 'Real-time development test',
  clientMessageId: crypto.randomUUID(),
};
console.log(await emitChat('chat:send', lastChatSend));
```

Both profiles should receive one `chat:message`. Repeat the same send with
`lastChatSend`: expect `replay: true`, the same message ID, and no second event.
A REST send should also appear live. Private images still use the existing
multipart REST endpoint and are announced through `chat:message`.

5. To simulate a network interruption, run `chatSocket.io.engine.close()` in one
   profile. After reconnect, the connect handler authenticates/rejoins and fetches
   history. To leave explicitly: `await emitChat('chat:leave', { chatId })`.
6. Sign out through the existing frontend: that session's sockets should disconnect.
   Another independently signed-in profile should remain connected.
7. Unauthorized-room tests are read-only: attempt a valid chat ID for which the
   account is not a member and expect 403. For account/event revocation and member
   removal tests, use disposable development records and intentionally perform
   those state changes yourself; do not alter existing project test records
   automatically. The isolated suite already exercises these cases without live writes.

No real database/browser-session integration test was performed during development.
Phase 4 React integration has not begun.

## Viva explanation

Socket.IO shares the Express HTTP server and authenticates with the existing
HTTP-only cookie. Joining and sending require approved chat membership, and each
recipient is checked again before private delivery. Messages commit to MongoDB
before publication; retry keys prevent duplicate records. Reconnection requires
fresh authorization and history reconciliation, while revoked access removes
room membership or disconnects the socket.