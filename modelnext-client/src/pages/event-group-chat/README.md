# Event Group Chat — Frontend

Start with `EventChats.jsx` for the chat hub and `EventChatRoom.jsx` for an individual event conversation. `EventChatAction.jsx` adds the event-level entry action.

`api.js` keeps the existing `/api/event-chats` contract, while `useConversation.js` manages history, Socket.IO joining, reconnect recovery, acknowledgements, and retry-safe sends. `OwnerTools.jsx`, `PrivateImage.jsx`, and `shared.jsx` provide the focused room UI pieces. `EventChat.css` contains all chat styling.

The shared `src/api.js`, authentication context, router, navbar, and event pages remain outside this folder. The viva order is: hub → room → API/hook → room components → tests.
