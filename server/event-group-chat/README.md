# Event Group Chat — Backend

`routes/eventChatRoutes.js` is mounted by `server/server.js` at `/api/event-chats`. It composes message and membership-management routes without changing public endpoint paths.

`models/` stores chat, message, invitation, and join-request schemas. `services/` implements authorization, message persistence and retry keys, private image storage, Socket.IO authentication, and real-time room delivery. `tests/testEventChatBackend.js` is the isolated backend regression suite; `docs/` contains endpoint and real-time details.

Shared Event/User models, authentication middleware, session cookies, notifications, MongoDB setup, and the main HTTP/Socket.IO server intentionally remain outside this folder. For a viva: route → service → model → Socket.IO realtime → tests.
