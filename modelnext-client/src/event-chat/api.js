import { API_BASE_URL, apiFetch } from '../api';

export class ChatError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export async function chatApi(path, options = {}) {
  const response = await apiFetch('/event-chats' + path, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new ChatError(data?.error || 'Chat request failed.', response.status);
  return data;
}
export const mutate = (path, body, method = 'POST', signal) => chatApi(path, { method, body: JSON.stringify(body), signal });
export function pagePath(path, cursor, cursorName = 'before') {
  const join = path.includes('?') ? '&' : '?';
  return path + join + 'limit=30' + (cursor ? '&' + cursorName + '=' + encodeURIComponent(cursor) : '');
}
export function mergeMessages(...pages) {
  const messages = new Map();
  pages.flat().forEach(message => messages.set(message.id, message));
  return [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function messageKey() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function uploadImage(chatId, pending, signal) {
  const body = new FormData();
  body.append('image', pending.file);
  body.append('text', pending.text);
  body.append('clientMessageId', pending.clientMessageId);
  const response = await fetch(API_BASE_URL + '/event-chats/' + chatId + '/messages/images', { method:'POST', credentials:'include', body, signal });
  const data = await response.json();
  if (!response.ok) throw new ChatError(data.error || 'Image upload failed.', response.status);
  return data;
}
export async function privateImage(chatId, messageId, signal) {
  // Construct only the authenticated API path; never use public upload URLs.
  const response = await fetch(API_BASE_URL + '/event-chats/' + chatId + '/messages/' + messageId + '/image', { credentials:'include', cache:'no-store', signal });
  if (!response.ok) throw new ChatError('Private image is unavailable.', response.status);
  return response.blob();
}
export function acknowledge(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(12000).emit(event, payload, (error, result) => {
      if (error) return reject(new ChatError('Delivery confirmation timed out. Retry the same message.', 0));
      if (!result?.ok) return reject(new ChatError(result?.error || 'Chat operation failed.', result?.status));
      resolve(result);
    });
  });
}
// Recover all missed pages, including gaps longer than one history page.
export async function recoverHistory(chatId, knownIds, signal) {
  let cursor = null;
  let messages = [];
  do {
    const page = await chatApi(pagePath('/' + chatId + '/messages', cursor), {signal});
    messages = mergeMessages(messages, page.messages);
    cursor = page.nextCursor;
    if (!knownIds.size || page.messages.some(message => knownIds.has(message.id))) break;
  } while (cursor);
  return { messages, nextCursor: cursor };
}
