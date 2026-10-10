# Event Group Chat backend — Phase 2

All paths below are relative to `/api/event-chats`. Every endpoint requires the
existing `modelnext_user_session` cookie and a currently approved regular-user
account. Use `credentials: 'include'` and the same hostname as the frontend.
No separate authentication or client-submitted sender identity is used.

## Endpoints

| Method | Path | Authorization / input |
| --- | --- | --- |
| POST | `/events/:eventId` | Existing event-owner creation endpoint; approved event |
| POST | `/:chatId/invitations` | Existing owner-only endpoint; `{ invitedUserId, invitedUserRole }` |
| PATCH | `/invitations/:invitationId/respond` | Actual recipient ID + role; `{ action: 'accept' or 'decline' }` |
| GET | `/invitations/mine` | Only this account's received invitations |
| GET | `/:chatId/invitations` | Owner-only sent invitations, with safe recipient display names |
| GET | `/:chatId/users?role=model&q=name` | Owner-only approved account discovery; role must be model, photographer, agency, or client |
| GET | `/events/:eventId/chat` | Approved event; chat availability and this account's invitation/request state; no membership list |
| POST | `/:chatId/join-requests` | Approved nonmember; no user identity fields needed |
| GET | `/join-requests/mine` | Only this account's requests |
| GET | `/:chatId/join-requests` | Owner-only incoming requests, with safe requester names |
| PATCH | `/join-requests/:requestId/respond` | Owner-only; `{ action: 'approve' or 'reject' }` |
| GET | `/mine` | Owned/joined chats whose events remain approved |
| GET | `/:chatId` | Member or owner; safe header, no entire membership list |
| GET | `/:chatId/members` | Member or owner; paginated safe member names, roles, IDs, join dates |
| DELETE | `/:chatId/members/:role/:userId` | Owner-only; cannot remove the owner |
| GET | `/:chatId/messages` | Member-only; paginated history |
| POST | `/:chatId/messages` | Member-only; `{ text, clientMessageId }` |
| POST | `/:chatId/messages/images` | Member-only multipart fields: `image`, `clientMessageId`, optional `text` caption |
| GET | `/:chatId/messages/:messageId/image` | Member-only; message must belong to this exact chat |

Creation returns 201. Replaying an identical message key returns 200 with
`replay: true`; reusing the key for another payload returns 409. Response/review
operations return 200. Removal returns 204. Validation errors return 400;
authentication failures 401; forbidden/unapproved resources 403; missing resources
404; duplicates/completed transitions 409; oversized uploads 413; invalid image
content 415; upload throttling 429; unsupported transactions/uncertain commits 503.
Other database errors return a generic 500 without database details.

## Responses and pagination

- Invitation lists: `{ invitations, nextCursor }`. Request lists:
  `{ requests, nextCursor }`. List records retain MongoDB `_id`; creation and
  response objects use `id` as in the existing endpoints.
- Received invitation/request lists include a safe chat summary with `available`.
  An unavailable/deleted event does not expose its title. Historical status
  remains visible to the recipient/requester even when chat access is blocked.
- Discovery: `{ users: [{ id, role, name }], nextCursor }`. No contact details,
  addresses, media paths, passwords, identity files, or verification evidence.
- Chats: `{ chats, nextCursor }`; chat detail: `{ chat }`.
- Members: `{ members: [{ id, role, name, joinedAt, isOwner }], nextCursor }`.
  Revoked/deleted members display `Unavailable account` until removed.
- Message send: `{ message, replay }`. History: `{ messages, nextCursor }`.
  Message fields: `id`, `chatId`, `clientMessageId`, `sender: { id, role, name }`,
  `messageType`, `text`, `createdAt`, and safe image metadata when applicable.
  Names are resolved from currently approved accounts; unavailable senders use a
  placeholder. Clients must render text as text, never raw HTML.
- All paginated lists support `limit=1..100`, default 30.
- Invitation/request/discovery/chat lists use `before=<nextCursor>` (ObjectId).
  Status filtering is available for invitation/request lists.
- History uses an opaque `before=<nextCursor>` containing timestamp + ObjectId.
  Pages return oldest-to-newest within that page; prepend older pages in the UI.
- Members use `memberBefore=<nextCursor>` (ID:role), not `before`.
- `/mine` filters unavailable events after selecting a page. A page can therefore
  be empty while `nextCursor` is present; continue pagination until it is null.

## Transactions, concurrency, and membership

MongoDB must be a replica set or sharded deployment for invitation responses,
join submission/review, removal, and message sends. These operations fail closed
on a standalone deployment. No unsafe multi-document fallback is used.

Transactions use snapshot reads and majority writes. Approval documents and the
chat receive a real increment to an internal `_chatAccessVersion` field inside the
transaction. This serializes chat writes against concurrent event/account
revocation, deletion, and member removal rather than relying only on a snapshot
read. The fixed server-owned guard field is written with strict casting disabled only
for that trusted increment; no client update object is accepted. It leaves
Mongoose's `__v` semantics untouched. These increments do not alter approval/profile fields or their
`updatedAt` timestamps. They serialize writes to the same event and can limit
throughput at very large scale.

Both invitation acceptance and owner-approved join requests use a conditional
`$push` guarded by an ID/role `$elemMatch`. Membership is not added during
invitation or join-request creation. Completed response/review requests return
409. Notifications participate in response/review transactions, so a failed
notification write rolls back the associated state transition.

The original invitation send endpoint remains compatible with its previous
nontransactional behavior. Its notification is best effort: invitation creation
succeeds even if the notification fails. Its approval checks occur before the
write; they are not serialized against simultaneous approval changes. Subsequent
acceptance and chat access always revalidate approval.

Existing invitation and join-request unique indexes cover every status, not only
pending. Reinvitation after decline and resubmission after rejection are
intentionally unsupported. No migration or index rebuild was run. The new
message retry index is partial so old records without `clientMessageId` remain
compatible. Ensure declared indexes exist in the deployment before release;
Mongoose's configured index policy determines creation at application startup.

`clientMessageId` is required for new message sends: 8–100 ASCII letters, digits,
underscores, or hyphens. Generate it once with `crypto.randomUUID()` and reuse it
only when retrying that exact message. The database index scopes it to chat,
sender ID, and sender role. An uncertain commit returns 503; refresh history or
retry the identical key rather than generating another key.

Deleted/rejected events block chat access; revoked accounts fail authentication;
removed members fail subsequent message/image access checks. Read/download
requests authorized before revocation may already be in flight. Removal changes
current membership; it does not cancel outstanding invitations or join requests.
A still-pending invitation or later owner approval may grant access again.
Historical accepted/approved records do not automatically restore membership.

## Private images

Uploads accept one nonanimated JPEG, PNG, or WebP, up to 5 MiB and 16 megapixels.
Sharp fully decodes and re-encodes to WebP, strips metadata, auto-orients, and limits
output dimensions to 2560 × 2560. The filename and declared MIME type are not
trusted. SVG, GIF, video, executable payloads, corrupt content, and animated
images are rejected. A valid raster with a misleading filename is re-encoded
safely; the original bytes/name are never stored.

Files are stored lazily in `server/private/event-chat-images/`, outside public
`/uploads`. Only a server-generated UUID filename is stored privately. API
responses contain protected retrieval URLs and safe dimensions/size, never local
paths or storage keys. Retrieval rechecks session, event approval, membership,
and chat-message association. Responses use no-store caching and nosniff.
Existing public profile uploads are unchanged.

Uploads are limited to ten attempts/account/minute and four in-flight uploads
per process. Deploy a shared reverse-proxy limiter for multi-instance hosting.
Provision persistent, access-restricted storage for the private directory and
back it up with MongoDB. On Windows, configure filesystem ACLs; POSIX mode flags
alone do not establish Windows ACLs.

Known failed message transactions clean their newly written file. Image retries
remove the redundant new file. An uncertain commit deliberately retains its
file. A process crash between file storage and database commit can leave an
orphan: reconciliation must compare private file keys with message references
before deletion. No automatic deletion job is included or was run.

## Notifications

Existing recipient-scoped notification APIs/dashboards display invitations,
invitation responses, join submissions/reviews, and membership removal.
Notifications contain generic text with no private contact information. The
existing schema is unchanged, so notifications have no chat deep-link metadata.
Per-message notifications are intentionally omitted to avoid flooding the
existing notification feed; live message delivery belongs to Phase 3.

## Non-destructive verification

From the project root:

```powershell
node --test server/test/testEventChatBackend.js
```

Tests use an isolated module loader, actual cookie/JWT middleware, a loopback HTTP
server, fake in-memory models and transactions, and memory-only image storage.
The real Sharp decoder and message schema validation are exercised. `.env` is
not loaded, MongoDB is never connected, and development records are untouched.
The fake transaction serializes callbacks: these tests verify application
outcomes and rollback/error paths, not actual MongoDB conflict handling.

Live replica-set transactions, index presence, on-disk media persistence/ACLs,
and end-to-end browser flows remain to be verified using an explicitly approved
disposable development database. Do not run writing tests against existing data.

Safe browser-console read example from the signed-in frontend:

```js
const base = `http://${location.hostname}:5000/api/event-chats`;
const response = await fetch(`${base}/invitations/mine?status=pending`, {
  credentials: 'include',
});
const result = await response.json();
console.log(response.status, result);
```

For writes, use disposable records and the correct authenticated account. A
message send is `POST /:chatId/messages` with JSON `{ text: 'Hello',
clientMessageId: crypto.randomUUID() }`. A private image send uses `FormData`;
do not manually set its Content-Type boundary. Acceptance uses the invited
account; review and removal use the owner. Test another-role/same-ID cases,
nonmember access, repeated requests, concurrent acceptance/join approval,
revocation, and private image URLs in a signed-out browser.

## Scope and known limitations

This document describes the Phase 2 REST APIs. Phase 3 Socket.IO integration is
now documented in [event-group-chat-realtime.md](event-group-chat-realtime.md).
React frontend integration remains Phase 4. No commit, push, branch, database
migration, index operation, or live test-record creation was performed.
Sharp was added for content decoding; Multer was updated within major version 2
for upload-security fixes. Other pre-existing npm audit findings remain and need
a separate compatibility-reviewed dependency update before production release.

Viva: The backend uses the existing approved-user session and checks both account
ID and role. Invitations and join requests are explicit consent/approval steps,
not membership. Transactions commit status and membership together; guarded
updates prevent duplicate members. Messages are persistent and retry-safe, and
private images are decoded, sanitized, and served only after membership checks.