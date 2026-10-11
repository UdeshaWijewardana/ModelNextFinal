import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChatGate, ListState, Notice, useList } from './shared';
import { mutate } from './api';
import { accountRouteForRole, useAuth } from '../../context/AuthContext';

function ChatRail({ chats }) {
  const { role } = useAuth();
  return <aside className="ec-rail" aria-label="Event group chat navigation">
    <Link className="ec-dashboard-link" to={accountRouteForRole(role)}>← Back to Dashboard</Link>
    <p className="ec-eyebrow">MODELNEXT COLLABORATION</p>
    <h1>Event Group Chats</h1>
    <div className="ec-rail-heading"><span>Authorized conversations</span><button type="button" onClick={chats.refresh} disabled={chats.loading}>Refresh</button></div>
    <nav className="ec-chat-list" aria-label="Authorized conversations">
      {chats.items.map(chat => <Link className="ec-chat-link" key={chat.id} to={'/event-chats/' + chat.id}><strong>{chat.eventTitle}</strong><span>{chat.isOwner ? 'Owner · manage and chat' : 'Member · open conversation'}</span></Link>)}
    </nav>
    <ListState list={chats}/>
  </aside>;
}

function Hub() {
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const fail = error => { if ([401, 403].includes(error.status)) setBlocked(error.message); };
  const chats = useList('/mine', 'chats', fail);
  const invitations = useList('/invitations/mine', 'invitations', fail);
  const requests = useList('/join-requests/mine', 'requests', fail);
  const respond = async (invitation, action) => {
    setBusy(invitation._id); setError('');
    try {
      await mutate('/invitations/' + invitation._id + '/respond', { action }, 'PATCH');
      invitations.refresh(); chats.refresh();
      if (action === 'accept') navigate('/event-chats/' + invitation.chatId);
    } catch (caught) { fail(caught); setError(caught.message); invitations.refresh(); }
    finally { setBusy(''); }
  };
  if (blocked) return <Notice error={blocked}/>;
  return <div className="ec-app-shell ec-hub-shell"><ChatRail chats={chats}/><main className="ec-hub-main">
    <header className="ec-room-header"><div><p className="ec-eyebrow">EVENT COLLABORATION</p><h2>Manage your conversations</h2><p>Accept invitations and keep track of event-specific access.</p></div><Link className="ec-secondary-link" to="/events">Browse events</Link></header>
    {error && <Notice error={error}/>}
    <div className="ec-hub-grid">
      <section className="ec-card"><div className="ec-section-title"><h2>My chat invitations</h2><button onClick={invitations.refresh} disabled={invitations.loading}>Refresh</button></div>{invitations.items.map(item => <article className="ec-row" key={item._id}><strong>{item.chat?.eventTitle || 'Unavailable event'}</strong><span className="ec-badge">{item.status}</span>{item.chat?.available && item.status === 'pending' && <div className="ec-actions"><button disabled={Boolean(busy)} onClick={() => respond(item, 'accept')}>Accept</button><button disabled={Boolean(busy)} onClick={() => respond(item, 'decline')}>Decline</button></div>}{item.chat?.available && item.status === 'accepted' && <Link to={'/event-chats/' + item.chatId}>Check chat access</Link>}</article>)}<ListState list={invitations}/></section>
      <section className="ec-card"><div className="ec-section-title"><h2>My join requests</h2><button onClick={requests.refresh} disabled={requests.loading}>Refresh</button></div>{requests.items.map(item => <article className="ec-row" key={item._id}><strong>{item.chat?.eventTitle || 'Unavailable event'}</strong><span className="ec-badge">{item.status}</span>{item.chat?.available && item.status === 'approved' && <Link to={'/event-chats/' + item.chatId}>Check chat access</Link>}</article>)}<ListState list={requests}/></section>
    </div>
  </main></div>;
}

export default function EventChats() {
  return <main className="ec-page"><ChatGate><Hub/></ChatGate></main>;
}
