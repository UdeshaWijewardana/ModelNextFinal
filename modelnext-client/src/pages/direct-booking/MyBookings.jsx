import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { apiFetch, readJson } from '../../api';
import { useAuth } from '../../context/AuthContext';
import './DirectBooking.css';

const date = value => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' });
const today = () => new Date().toISOString().slice(0, 10);
function BookingList({ title, items, received, disputes, onRespond, onComplete, onReport, onViewDispute, busy }) {
  return <section className="direct-booking-panel"><h2>{title}</h2>{!items.length ? <p className="direct-booking-empty">No {title.toLowerCase()} yet.</p> : <div className="direct-booking-list">{items.map(item => { const ownDispute = disputes.find(dispute => String(dispute.bookingId) === String(item.id) && dispute.isComplainant); return <article key={item.id}><div><span className={`direct-booking-status is-${item.status}`}>{item.status}</span><h3>{item.jobType}</h3><p>{received ? `From ${item.requesterName}` : `With ${item.talentName}`} · {date(item.bookingDate)} · {item.location}</p></div><div className="direct-booking-actions"><Link to={`/my-bookings/${item.id}`}>View Details</Link>{received && item.status === 'pending' && <><button disabled={busy === item.id} onClick={() => onRespond(item.id, 'confirmed')}>Accept</button><button className="is-danger" disabled={busy === item.id} onClick={() => onRespond(item.id, 'declined')}>Decline</button></>}{!received && item.status === 'confirmed' && item.bookingDate <= today() && <button disabled={busy === item.id} onClick={() => onComplete(item.id)}>Mark as Completed</button>}{['confirmed', 'completed'].includes(item.status) && <Link to={`/private-messages/${item.id}`}>Open Chat</Link>}{['confirmed', 'completed'].includes(item.status) && (ownDispute ? <button type="button" onClick={() => onViewDispute(ownDispute)}>Issue Reported</button> : <button type="button" onClick={() => onReport(item)}>Report Issue</button>)}</div></article>; })}</div>}</section>;
}
export default function MyBookings() {
  const auth = useAuth(); const location = useLocation();
  const [data, setData] = useState({ sent: [], received: [] }); const [disputes, setDisputes] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [busy, setBusy] = useState('');
  const [reportBooking, setReportBooking] = useState(null); const [viewDispute, setViewDispute] = useState(null); const [reason, setReason] = useState(''); const [description, setDescription] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const bookingsData = await readJson(await apiFetch('/direct-bookings')); setData(bookingsData); try { const disputesData = await readJson(await apiFetch('/disputes')); setDisputes(disputesData.disputes || []); } catch (_disputeError) { setError('Bookings loaded, but issue reports are temporarily unavailable.'); } } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { if (auth.status === 'authenticated') load(); }, [auth.status, load]);
  const respond = async (id, status) => { setBusy(id); setError(''); try { await readJson(await apiFetch(`/direct-bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })); await load(); } catch (caught) { setError(caught.message); } finally { setBusy(''); } };
  const complete = async id => {
    if (!window.confirm('Mark this booking as completed? This action cannot be undone.')) return;
    setBusy(id); setError(''); setSuccess('');
    try {
      const result = await readJson(await apiFetch(`/direct-bookings/${id}/complete`, { method: 'PATCH' }));
      setData(current => ({ ...current, sent: current.sent.map(item => item.id === id ? result.booking : item) }));
      setSuccess('Booking marked as completed.');
    } catch (caught) { setError(caught.message); } finally { setBusy(''); }
  };
  const openReport = booking => { setReportBooking(booking); setViewDispute(null); setReason(''); setDescription(''); setError(''); };
  const submitDispute = async event => {
    event.preventDefault(); setBusy(`dispute-${reportBooking.id}`); setError(''); setSuccess('');
    try { const result = await readJson(await apiFetch('/disputes', { method: 'POST', body: JSON.stringify({ bookingId: reportBooking.id, reason, description }) })); setDisputes(current => [result.dispute, ...current]); setReportBooking(null); setSuccess('Issue reported successfully.'); }
    catch (caught) { setError(caught.message); } finally { setBusy(''); }
  };
  const closeDialog = () => { setReportBooking(null); setViewDispute(null); setError(''); };
  return <div className="direct-booking-page"><Navbar /><main className="direct-booking-shell"><header><p>ModelNext workspace</p><h1>My Bookings</h1><span>Manage direct professional assignments separately from events.</span></header>{location.state?.bookingSent && <p className="direct-booking-notice" role="status">Booking request sent.</p>}{success && <p className="direct-booking-notice" role="status">{success}</p>}{error && !reportBooking && !viewDispute && <p className="direct-booking-error" role="alert">{error}</p>}{loading ? <p role="status">Loading bookings...</p> : <>{['client', 'agency', 'photographer'].includes(auth.role) && <BookingList title="Sent Bookings" items={data.sent} disputes={disputes} onRespond={respond} onComplete={complete} onReport={openReport} onViewDispute={setViewDispute} busy={busy} />}{['model', 'photographer'].includes(auth.role) && <BookingList title="Received Bookings" items={data.received} disputes={disputes} received onRespond={respond} onReport={openReport} onViewDispute={setViewDispute} busy={busy} />}</>}
    {(reportBooking || viewDispute) && <div className="direct-dispute-overlay" role="presentation"><section className="direct-dispute-dialog" role="dialog" aria-modal="true" aria-labelledby="dispute-title"><button className="direct-dispute-close" type="button" onClick={closeDialog} aria-label="Close">×</button>{reportBooking ? <><h2 id="dispute-title">Report Issue</h2><p>{reportBooking.jobType} · {date(reportBooking.bookingDate)}</p>{error && <p className="direct-booking-error" role="alert">{error}</p>}<form onSubmit={submitDispute}><label>Reason<select required value={reason} onChange={event => setReason(event.target.value)}><option value="">Select a reason</option>{['No-show', 'Unprofessional behavior', 'Payment issue', 'Service quality', 'Harassment', 'Other'].map(item => <option key={item}>{item}</option>)}</select></label><label>Description<textarea required minLength="10" maxLength="1000" value={description} onChange={event => setDescription(event.target.value)} /></label><small>{description.length}/1000</small><button className="direct-booking-submit" disabled={busy === `dispute-${reportBooking.id}`}>{busy === `dispute-${reportBooking.id}` ? 'Submitting…' : 'Submit'}</button></form></> : <><h2 id="dispute-title">Reported Issue</h2><span className={`direct-booking-status is-${viewDispute.status}`}>{viewDispute.status.replace('_', ' ')}</span><dl><div><dt>Reason</dt><dd>{viewDispute.reason}</dd></div><div><dt>Description</dt><dd>{viewDispute.description}</dd></div><div><dt>Submitted</dt><dd>{new Date(viewDispute.createdAt).toLocaleString()}</dd></div>{viewDispute.status === 'resolved' && <div><dt>Admin resolution</dt><dd>{viewDispute.adminResolution}</dd></div>}</dl></>}</section></div>}
  </main></div>;
}
