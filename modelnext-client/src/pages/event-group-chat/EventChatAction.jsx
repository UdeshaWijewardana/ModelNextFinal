import React, {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {chatApi, mutate} from './api';
import './EventChat.css';

export default function EventChatAction({eventId}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const inFlight = useRef(false);
  const generation = useRef(null);
  useEffect(() => {
    setData(null); setError(''); setBusy(false);
    const version = { active: true };
    generation.current = version;
    if (auth.status !== 'authenticated' || auth.kind !== 'user') return;
    const controller = new AbortController();
    chatApi('/events/' + eventId + '/chat', {signal:controller.signal}).then(result => { if (!controller.signal.aborted) setData(result); }).catch(error => { if (!controller.signal.aborted) setError(error.status === 404 ? 'Group chat is unavailable for this event.' : error.message); });
    return () => { controller.abort(); version.active = false; };
  }, [eventId, auth.status, auth.kind, auth.account, revision]);
  const act = async () => {
    if (inFlight.current || !data) return;
    const version = generation.current;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      if (data.canCreate) {
        const result = await mutate('/events/' + eventId, {});
        if (version.active) navigate('/event-chats/' + result.chat.id);
      } else { await mutate('/' + data.chat.id + '/join-requests', {}); if (version.active) setRevision(value => value + 1); }
    } catch (error) { if (version.active) setError(error.message); }
    finally { inFlight.current = false; if (version.active) setBusy(false); }
  };
  return <div className="ec-event-action">{error && <span role="alert">{error}</span>}{data && (
    data.canCreate ? <button type="button" disabled={busy} onClick={act}>CREATE GROUP CHAT</button> :
    !data.chat ? <span className="ec-muted">Group chat has not been created.</span> :
    data.chat.isMember || data.chat.isOwner ? <Link to={'/event-chats/' + data.chat.id}>OPEN GROUP CHAT</Link> :
    data.invitation?.status === 'pending' ? <Link to="/event-chats">Respond to chat invitation</Link> :
    data.request ? <span>Chat join request: {data.request.status} <Link to="/event-chats">View status</Link></span> :
    <button type="button" disabled={busy} onClick={act}>Request to join group chat</button>
  )}</div>;
}
