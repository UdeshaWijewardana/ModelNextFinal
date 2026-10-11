import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { eventDateTime } from '../components/MyEvents';
import { accountRouteForRole, useAuth } from '../context/AuthContext';
import { apiFetch, readJson, SERVER_BASE_URL } from '../api';
import EventChatAction from './event-group-chat/EventChatAction';

const present = value => value !== undefined && value !== null && value !== '';

function OwnerHeader({ back, onLogout, loggingOut }) {
  return <header className="owner-event-header"><div className="owner-event-header__inner">
    <Link className="owner-event-brand" to="/" aria-label="ModelNext home"><span>Model</span><strong>Next</strong></Link>
    <nav aria-label="Event details navigation"><Link className="owner-event-back" to={back}>Back to My Events</Link><Link to="/">Home</Link><button type="button" disabled={loggingOut} onClick={onLogout}>{loggingOut ? 'Logging out...' : 'Logout'}</button></nav>
  </div></header>;
}

function Details({ eventId, role, logout }) {
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const deletingRef = useRef(false);
  const back = `${accountRouteForRole(role)}?section=my-events`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setEvent(null); setError('');
    apiFetch(`/events/mine/${eventId}`, { signal: controller.signal }).then(readJson)
      .then(data => { if (!controller.signal.aborted) setEvent(data.event); })
      .catch(caught => { if (!controller.signal.aborted) setError(caught.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, revision]);
  const signOut = async () => { if (loggingOut) return; setLoggingOut(true); await logout(); navigate('/', { replace: true }); };
  const remove = async () => {
    if (deletingRef.current || !window.confirm('Delete this event? This cannot be undone.')) return;
    deletingRef.current = true; setDeleting(true); setError('');
    try { await readJson(await apiFetch(`/events/${eventId}`, { method: 'DELETE' })); navigate(back, { replace: true }); }
    catch (caught) { setError(caught.message); }
    finally { deletingRef.current = false; setDeleting(false); }
  };
  const overview = event ? [['Event type', event.eventType], ['Start', event.startDate ? eventDateTime(event.startDate) : null], ['End', event.endDate ? eventDateTime(event.endDate) : null], ['Location', event.location], ['Organizer', event.organizerName], ['Created', event.createdAt ? eventDateTime(event.createdAt) : null]].filter(([, value]) => present(value)) : [];
  const requirements = event ? [['Gender requirement', event.requiredGender], ['Minimum age', event.minAge], ['Maximum age', event.maxAge], ['Minimum height', event.minHeight], ['Maximum height', event.maxHeight], ['Categories', event.requiredCategories?.join(', ')], ['Skills', event.requiredSkills?.join(', ')]].filter(([, value]) => present(value)) : [];
  const image = event?.image && (/^https?:\/\//i.test(event.image) ? event.image : `${SERVER_BASE_URL}/${event.image.replace(/\\/g, '/').replace(/^\/+/, '')}`);
  const status = event?.status || 'pending';
  return <div className="owned-event-page"><OwnerHeader back={back} onLogout={signOut} loggingOut={loggingOut} /><main className="owned-event-details">
    {loading && <div className="owned-event-state" role="status">Loading event...</div>}
    {error && <div className="owned-event-state owned-event-state--error" role="alert"><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {!loading && event && <>
      <header className="owned-event-hero"><div><p className="owned-event-eyebrow">Event details</p><div className="owned-event-title-row"><h1>{event.title}</h1><span className={`owned-event-status owned-event-status--${status}`}>{status}</span></div>{event.description && <p className="owned-event-description">{event.description}</p>}</div>{image && <img className="owned-event-image" src={image} alt="" />}</header>
      <section className="owned-event-panel" aria-labelledby="event-overview-heading"><div className="owned-event-section-heading"><p>01</p><h2 id="event-overview-heading">Overview</h2></div><dl className="owned-event-grid">{overview.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{requirements.length > 0 && <><div className="owned-event-subheading">Talent requirements</div><dl className="owned-event-grid owned-event-grid--requirements">{requirements.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>}{event.rejectionReason && <div className="owned-event-rejection"><strong>Rejection reason</strong><p>{event.rejectionReason}</p></div>}</section>
      <section className="owned-event-panel owned-event-chat" aria-labelledby="event-chat-heading"><div className="owned-event-section-heading"><p>02</p><div><h2 id="event-chat-heading">Event group chat</h2><span>Coordinate with your confirmed event team in one place.</span></div></div>{status === 'approved' ? <EventChatAction key={eventId} eventId={eventId} /> : <p className="owned-event-muted">Group chat is available after event approval.</p>}</section>
      <section className="owned-event-actions" aria-labelledby="event-actions-heading"><div><h2 id="event-actions-heading">Owner actions</h2><p>Update this event or permanently remove it.</p></div><div><Link className="owned-event-edit" to={`/account/events/${eventId}/edit`}>Edit Event</Link><button className="owned-event-delete" type="button" disabled={deleting} onClick={remove}>{deleting ? 'Deleting...' : 'Delete Event'}</button></div></section>
    </>}
  </main></div>;
}

export default function OwnedEventDetails() {
  const { eventId } = useParams();
  const auth = useAuth();
  const allowed = auth.status === 'authenticated' && auth.kind === 'user' && ['client', 'photographer', 'agency'].includes(auth.role);
  if (auth.status === 'loading') return <main className="owned-event-auth-state">Checking your session...</main>;
  if (!allowed) return <main className="owned-event-auth-state">An event-owner account is required. <Link to="/login">Sign in</Link></main>;
  return <Details key={`${auth.role}:${auth.account?.id}:${eventId}`} eventId={eventId} role={auth.role} logout={auth.logout} />;
}
