import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import Navbar from '../components/Navbar';
import {useAuth} from '../context/AuthContext';
import {ChatGate, Notice} from '../event-chat/shared';
import {messageKey, uploadImage} from '../event-chat/api';
import useConversation from '../event-chat/useConversation';
import PrivateImage from '../event-chat/PrivateImage';
import OwnerTools, {Members} from '../event-chat/OwnerTools';

function Conversation({chatId}) {
  const {account,role} = useAuth();
  const chat = useConversation(chatId);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const membersChanged = () => {
    setRevision(value => value + 1);
    chat.refreshHeader();
  };
  const fileInput = useRef(null);
  const scroll = useRef(null);
  const nearBottom = useRef(true);
  const preserve = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {
    if (!file) {setPreview(''); return;}
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (chat.revoked) {setText('');setFile(null);setPending(null);setError('');} }, [chat.revoked]);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (preserve.current && chat.loading) return;
    if (preserve.current) {element.scrollTop = preserve.current.top + element.scrollHeight - preserve.current.height; preserve.current = null;}
    else if (nearBottom.current) element.scrollTop = element.scrollHeight;
  }, [chat.messages,chat.loading]);
  const selectFile = event => {
    const selected = event.target.files[0]; setError('');
    if (selected && (!['image/jpeg','image/png','image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024)) {
      setError('Choose a JPEG, PNG or WebP image up to 5 MiB.'); event.target.value = ''; return;
    }
    setFile(selected || null);
  };
  const send = async event => {
    event?.preventDefault(); if (busy) return;
    const candidate = pending || {text:text.trim(),file,clientMessageId:messageKey()};
    if (!candidate.file && !candidate.text) return;
    setPending(candidate); setBusy(true); setError('');
    try {
      if (candidate.file) {
        const result = await uploadImage(chatId,candidate,chat.signal);
        chat.merge([result.message]);
      } else await chat.send(candidate);
      if (!mounted.current || chat.signal?.aborted) return;
      setText('');setFile(null);setPending(null); if(fileInput.current) fileInput.current.value = '';
      nearBottom.current = true;
    } catch (error) { if (mounted.current && error.name !== 'AbortError') {setError(error.message);chat.fail(error);if ([400,413,415].includes(error.status)) setPending(null);} }
    finally {if (mounted.current) setBusy(false);}
  };
  const older = async () => {
    const element = scroll.current;
    if (element) preserve.current = {height:element.scrollHeight,top:element.scrollTop};
    await chat.older();
  };
  if (chat.revoked) return <><Link to="/event-chats">All chats</Link><Notice error={chat.revoked}/><p>Private chat content has been cleared. <Link to="/login">Sign in again</Link> if your session expired.</p><button onClick={() => window.location.reload()}>Check access again</button></>;
  return <><header className="ec-heading"><div><Link to="/event-chats">All chats</Link><h1>{chat.chat?.eventTitle || 'Event group chat'}</h1><span className="ec-connection" role="status">{chat.connection}{chat.chat ? ' | ' + chat.chat.memberCount + ' members' : ''}</span></div>{chat.connection !== 'Live' && <button onClick={chat.reconnect}>Reconnect</button>}</header>{chat.error && <Notice error={chat.error}/>}
    <div className="ec-room-grid"><section className="ec-conversation" aria-label="Event conversation"><div className="ec-history" ref={scroll} onScroll={() => {const element = scroll.current; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;}}>
      {chat.cursor && <button className="ec-older" disabled={chat.loading} onClick={older}>Load older messages</button>}{chat.loading && <Notice>Loading messages...</Notice>}{!chat.loading && !chat.messages.length && <div className="ec-empty"><h2>Start the conversation</h2><p>Share plans, ideas, and event images with your group.</p></div>}
      <ol className="ec-messages" aria-label="Message history">{chat.messages.map(message => {
        const own = message.sender.id === (account?.id || account?._id) && message.sender.role === role;
        return <li key={message.id} className={'ec-message ' + (own ? 'ec-own' : '')}><div className="ec-message-meta"><strong>{own ? 'You' : message.sender.name}</strong><span>{message.sender.role}</span></div>{message.messageType === 'image' && <PrivateImage chatId={chatId} message={message} onError={chat.fail}/>} {message.text && <p>{message.text}</p>}<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time></li>;
      })}</ol></div>
      <form className="ec-composer" onSubmit={send}>{error && <Notice error={error}/>} {pending && !busy && <p className="ec-muted">Delivery was not confirmed. Retry sends the exact same message safely.</p>}{preview && <div className="ec-preview"><img src={preview} alt="Selected attachment preview"/>{!pending && <button type="button" onClick={() => {setFile(null);if(fileInput.current)fileInput.current.value='';}}>Remove image</button>}</div>}
        <label htmlFor="ec-message-input">Message {pending ? '(locked for safe retry)' : ''}</label><textarea id="ec-message-input" value={text} maxLength={5000} disabled={busy || Boolean(pending)} onChange={event => setText(event.target.value)} placeholder="Write a message to your event group..." rows={3}/><div className="ec-composer-actions"><label className="ec-file">Attach image<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || Boolean(pending)} onChange={selectFile}/></label><span className="ec-muted">{text.length}/5000</span><button type="submit" disabled={busy || chat.connection !== 'Live' || (!pending && !file && !text.trim())}>{busy ? 'Sending...' : pending ? 'Retry message' : 'Send message'}</button></div><small className="ec-muted">Private JPEG, PNG or WebP | up to 5 MiB. Images must be nonanimated.</small></form>
    </section><aside className="ec-chat-sidebar">{chat.chat && <><Members chatId={chatId} isOwner={chat.chat.isOwner} onError={chat.actionError} revision={revision} onChanged={chat.refreshHeader}/>{chat.chat.isOwner && <OwnerTools chatId={chatId} onError={chat.actionError} onMembersChanged={membersChanged}/>}</>}</aside></div></>;
}
export default function EventChatRoom() {const {chatId:routeChatId} = useParams();const chatId = routeChatId.toLowerCase();return <><Navbar/><main className="ec-page"><ChatGate>{/^[a-f0-9]{24}$/i.test(chatId) ? <Conversation key={chatId} chatId={chatId}/> : <Notice error="Invalid chat ID."/>}</ChatGate></main></>;}
