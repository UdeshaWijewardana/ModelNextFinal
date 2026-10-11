import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ChatGate, ListState, Notice, useList } from './shared';
import { messageKey, uploadImage } from './api';
import useConversation from './useConversation';
import PrivateImage from './PrivateImage';
import OwnerTools, { Members } from './OwnerTools';

function ConversationRail({ chatId }) {
  const chats = useList('/mine', 'chats');
  return <aside className="ec-rail ec-rail--room" aria-label="Event group chat navigation">
    <Link className="ec-dashboard-link" to="/client-portal">← Back to Dashboard</Link>
    <Link className="ec-back-link" to="/event-chats">← All chats</Link>
    <p className="ec-eyebrow">EVENT GROUP CHATS</p>
    <div className="ec-rail-heading"><span>Conversations</span><button type="button" onClick={chats.refresh} disabled={chats.loading}>Refresh</button></div>
    <nav className="ec-chat-list" aria-label="Authorized conversations">
      {chats.items.map(item => <Link className={`ec-chat-link ${item.id === chatId ? 'is-active' : ''}`} key={item.id} to={'/event-chats/' + item.id}><strong>{item.eventTitle}</strong><span>{item.isOwner ? 'Owner' : 'Member'}</span></Link>)}
    </nav>
    <ListState list={chats}/>
  </aside>;
}

function Conversation({ chatId }) {
  const { account, role } = useAuth();
  const chat = useConversation(chatId);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const membersChanged = () => { setRevision(value => value + 1); chat.refreshHeader(); };
  const fileInput = useRef(null);
  const scroll = useRef(null);
  const nearBottom = useRef(true);
  const preserve = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => { if (chat.revoked) { setText(''); setFile(null); setPending(null); setError(''); } }, [chat.revoked]);
  useLayoutEffect(() => { const element = scroll.current; if (!element) return; if (preserve.current && chat.loading) return; if (preserve.current) { element.scrollTop = preserve.current.top + element.scrollHeight - preserve.current.height; preserve.current = null; } else if (nearBottom.current) element.scrollTop = element.scrollHeight; }, [chat.messages, chat.loading]);
  const selectFile = event => { const selected = event.target.files[0]; setError(''); if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024)) { setError('Choose a JPEG, PNG or WebP image up to 5 MiB.'); event.target.value = ''; return; } setFile(selected || null); };
  const send = async event => {
    event?.preventDefault(); if (busy) return;
    const candidate = pending || { text: text.trim(), file, clientMessageId: messageKey() };
    if (!candidate.file && !candidate.text) return;
    setPending(candidate); setBusy(true); setError('');
    try { if (candidate.file) { const result = await uploadImage(chatId, candidate, chat.signal); chat.merge([result.message]); } else await chat.send(candidate); if (!mounted.current || chat.signal?.aborted) return; setText(''); setFile(null); setPending(null); if (fileInput.current) fileInput.current.value = ''; nearBottom.current = true; }
    catch (caught) { if (mounted.current && caught.name !== 'AbortError') { setError(caught.message); chat.fail(caught); if ([400, 413, 415].includes(caught.status)) setPending(null); } }
    finally { if (mounted.current) setBusy(false); }
  };
  const older = async () => { const element = scroll.current; if (element) preserve.current = { height: element.scrollHeight, top: element.scrollTop }; await chat.older(); };
  if (chat.revoked) return <div className="ec-revoked"><Link to="/event-chats">All chats</Link><Notice error={chat.revoked}/><p>Private chat content has been cleared. <Link to="/login">Sign in again</Link> if your session expired.</p><button onClick={() => window.location.reload()}>Check access again</button></div>;
  return <div className="ec-app-shell ec-room-shell"><ConversationRail chatId={chatId}/><main className="ec-room-main">
    <header className="ec-room-header"><div><Link className="ec-back-link" to="/event-chats">← Back to chats</Link><h1>{chat.chat?.eventTitle || 'Event group chat'}</h1><span className="ec-connection" role="status">{chat.connection}{chat.chat ? ' | ' + chat.chat.memberCount + ' members' : ''}</span></div>{chat.connection !== 'Live' && <button onClick={chat.reconnect}>Reconnect</button>}</header>
    {chat.error && <Notice error={chat.error}/>}
    <div className="ec-room-grid"><section className="ec-conversation" aria-label="Event conversation"><div className="ec-history" ref={scroll} onScroll={() => { const element = scroll.current; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100; }}>
      {chat.cursor && <button className="ec-older" disabled={chat.loading} onClick={older}>Load older messages</button>}{chat.loading && <Notice>Loading messages...</Notice>}{!chat.loading && !chat.messages.length && <div className="ec-empty"><h2>Start the conversation</h2><p>Share plans, ideas, and event images with your group.</p></div>}
      <ol className="ec-messages" aria-label="Message history">{chat.messages.map(message => { const own = message.sender.id === (account?.id || account?._id) && message.sender.role === role; return <li key={message.id} className={'ec-message ' + (own ? 'ec-own' : '')}><div className="ec-message-meta"><strong>{own ? 'You' : message.sender.name}</strong><span>{message.sender.role}</span></div>{message.messageType === 'image' && <PrivateImage chatId={chatId} message={message} onError={chat.fail}/>} {message.text && <p>{message.text}</p>}<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></li>; })}</ol>
    </div><form className="ec-composer" onSubmit={send}>{error && <Notice error={error}/>} {pending && !busy && <p className="ec-muted">Delivery was not confirmed. Retry sends the exact same message safely.</p>}{preview && <div className="ec-preview"><img src={preview} alt="Selected attachment preview"/>{!pending && <button type="button" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}>Remove image</button>}</div>}
      <label className="ec-composer-label" htmlFor="ec-message-input">Message {pending ? '(locked for safe retry)' : ''}</label><textarea id="ec-message-input" value={text} maxLength={5000} disabled={busy || Boolean(pending)} onChange={event => setText(event.target.value)} placeholder="Write a message to your event group..." rows={1}/><div className="ec-composer-actions"><label className="ec-file">Attach image<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || Boolean(pending)} onChange={selectFile}/></label><span className="ec-muted">{text.length}/5000</span><button type="submit" disabled={busy || chat.connection !== 'Live' || (!pending && !file && !text.trim())}>{busy ? 'Sending...' : pending ? 'Retry message' : 'Send message'}</button></div><small className="ec-muted">Private JPEG, PNG or WebP · up to 5 MiB</small></form>
    </section><aside className="ec-chat-sidebar" aria-label="Members and chat management">{chat.chat && <><Members chatId={chatId} isOwner={chat.chat.isOwner} onError={chat.actionError} revision={revision} onChanged={chat.refreshHeader}/>{chat.chat.isOwner && <OwnerTools chatId={chatId} onError={chat.actionError} onMembersChanged={membersChanged}/>}</>}</aside></div>
  </main></div>;
}

export default function EventChatRoom() {
  const { chatId: routeChatId } = useParams();
  const chatId = routeChatId.toLowerCase();
  return <main className="ec-page ec-page--room"><ChatGate>{/^[a-f0-9]{24}$/i.test(chatId) ? <Conversation key={chatId} chatId={chatId}/> : <Notice error="Invalid chat ID."/>}</ChatGate></main>;
}
