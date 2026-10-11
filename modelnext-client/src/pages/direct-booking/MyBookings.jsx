import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { apiFetch, readJson } from '../../api';
import { useAuth } from '../../context/AuthContext';
import './DirectBooking.css';

const date = value => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' });
function BookingList({ title, items, received, onRespond, busy }) {
  return <section className="direct-booking-panel"><h2>{title}</h2>{!items.length ? <p className="direct-booking-empty">No {title.toLowerCase()} yet.</p> : <div className="direct-booking-list">{items.map(item => <article key={item.id}><div><span className={`direct-booking-status is-${item.status}`}>{item.status}</span><h3>{item.jobType}</h3><p>{received ? `From ${item.requesterName}` : `With ${item.talentName}`} · {date(item.bookingDate)} · {item.location}</p></div><div className="direct-booking-actions"><Link to={`/my-bookings/${item.id}`}>View Details</Link>{received && item.status === 'pending' && <><button disabled={busy === item.id} onClick={() => onRespond(item.id, 'confirmed')}>Accept</button><button className="is-danger" disabled={busy === item.id} onClick={() => onRespond(item.id, 'declined')}>Decline</button></>}{item.status === 'confirmed' && <Link to={`/private-messages/${item.id}`}>Open Chat</Link>}</div></article>)}</div>}</section>;
}
export default function MyBookings() {
  const auth = useAuth(); const location = useLocation();
  const [data, setData] = useState({ sent: [], received: [] }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setData(await readJson(await apiFetch('/direct-bookings'))); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { if (auth.status === 'authenticated') load(); }, [auth.status, load]);
  const respond = async (id, status) => { setBusy(id); setError(''); try { await readJson(await apiFetch(`/direct-bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })); await load(); } catch (caught) { setError(caught.message); } finally { setBusy(''); } };
  return <div className="direct-booking-page"><Navbar /><main className="direct-booking-shell"><header><p>ModelNext workspace</p><h1>My Bookings</h1><span>Manage direct professional assignments separately from events.</span></header>{location.state?.bookingSent && <p className="direct-booking-notice" role="status">Booking request sent.</p>}{loading ? <p role="status">Loading bookings...</p> : error ? <p className="direct-booking-error" role="alert">{error}</p> : <>{['client', 'agency', 'photographer'].includes(auth.role) && <BookingList title="Sent Bookings" items={data.sent} onRespond={respond} busy={busy} />}{['model', 'photographer'].includes(auth.role) && <BookingList title="Received Bookings" items={data.received} received onRespond={respond} busy={busy} />}</>}</main></div>;
}
