import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {chatApi, mutate} from './api';
import '../styles/EventChat.css';

export default function EventChatAction({eventId}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setData(null);
    if (auth.status !== 'authenticated' || auth.kind !== 'user') return;
    const controller = new AbortController();
    chatApi('/events/' + eventId + '/chat', {signal:controller.signal}).then(setData).catch(error => { if (!controller.signal.aborted) setError(error.status === 404 ? '' : error.message); });
    return () => controller.abort();
  }, [eventId, auth.status, auth.kind, auth.account, revision]);
  const act = async () => {
    setBusy(true); setError('');
    try {
      if (data.canCreate) {
        const result = await mutate('/events/' + eventId, {});
        navigate('/event-chats/' + result.chat.id);
      } else { await mutate('/' + data.chat.id + '/join-requests', {}); setRevision(value => value + 1); }
    } catch (error) { setError(error.message); setRevision(value => value + 1); }
    finally { setBusy(false); }
  };
  return <div className="ec-event-action">{error && <span role="alert">{error}</span>}{data && (
    data.canCreate ? <button type="button" disabled={busy} onClick={act}>Create group chat</button> :
    !data.chat ? <span className="ec-muted">Group chat has not been created.</span> :
    data.chat.isMember || data.chat.isOwner ? <Link to={'/event-chats/' + data.chat.id}>Open group chat</Link> :
    data.invitation?.status === 'pending' ? <Link to="/event-chats">Respond to chat invitation</Link> :
    data.request ? <span>Chat join request: {data.request.status} <Link to="/event-chats">View status</Link></span> :
    <button type="button" disabled={busy} onClick={act}>Request to join group chat</button>
  )}</div>;
}
