import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, readJson } from '../../api';
import { useAuth } from '../../context/AuthContext';
import './DirectBooking.css';

const jobs = ['Commercial Shoot', 'Fashion Editorial', 'Runway', 'Portfolio Shoot', 'Product Shoot', 'Other'];
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const dayKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const todayKey = () => {
  const today = new Date();
  return dayKey(today.getFullYear(), today.getMonth(), today.getDate());
};

export default function BookingForm({ talentId, talentRole, talentName, eventContext = null }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const dateInput = useRef(null);
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ jobType: jobs[0], bookingDate: '', location: '', description: '' });
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [availability, setAvailability] = useState({ bookedDates: [], manualDates: [] });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [dateError, setDateError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifiedEvent, setVerifiedEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const eventBooking = Boolean(eventContext?.eventId);
  const permitted = auth.status === 'authenticated' && auth.kind === 'user' && (eventBooking ? auth.role === 'client' && talentRole === 'model' : auth.role === 'client' || auth.role === 'agency' || (auth.role === 'photographer' && talentRole === 'model'));

  useEffect(() => {
    if (!open || !eventBooking) return undefined;
    const controller = new AbortController();
    setEventLoading(true); setVerifiedEvent(null); setError(''); setSuccess('');
    apiFetch(`/events/mine/${eventContext.eventId}`, { signal: controller.signal }).then(readJson)
      .then(data => {
        if (controller.signal.aborted) return;
        if (data.event?.status !== 'approved') throw new Error('This event must be approved before booking a model.');
        setVerifiedEvent(data.event);
      })
      .catch(caught => { if (!controller.signal.aborted) setError(caught.message || 'Unable to verify this event.'); })
      .finally(() => { if (!controller.signal.aborted) setEventLoading(false); });
    return () => controller.abort();
  }, [open, eventBooking, eventContext?.eventId]);

  useEffect(() => {
    if (!open || eventBooking) return undefined;
    const controller = new AbortController();
    setAvailabilityLoading(true);
    setAvailabilityError('');
    apiFetch(`/${talentRole === 'model' ? 'models' : 'photographers'}/${talentId}/availability?month=${monthKey(month)}`, { signal: controller.signal })
      .then(readJson)
      .then(data => { if (!controller.signal.aborted) setAvailability(data); })
      .catch(caught => { if (!controller.signal.aborted) setAvailabilityError(caught.message || 'Unable to load availability.'); })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [open, eventBooking, month, talentId, talentRole]);

  const booked = useMemo(() => new Set(availability.bookedDates || []), [availability.bookedDates]);
  const manual = useMemo(() => new Map((availability.manualDates || []).map(entry => [entry.date, entry.status])), [availability.manualDates]);
  const blockedReason = value => booked.has(value) ? 'This date is already booked.' : manual.get(value) === 'unavailable' ? 'This date is manually unavailable.' : '';
  const calendarDays = useMemo(() => {
    const year = month.getFullYear(); const monthIndex = month.getMonth();
    return [
      ...Array.from({ length: new Date(year, monthIndex, 1).getDay() }, (_, index) => ({ empty: true, key: `empty-${index}` })),
      ...Array.from({ length: new Date(year, monthIndex + 1, 0).getDate() }, (_, index) => {
        const key = dayKey(year, monthIndex, index + 1);
        return { key, day: index + 1, booked: booked.has(key), status: booked.has(key) ? '' : manual.get(key), past: key < todayKey() };
      }),
    ];
  }, [booked, manual, month]);

  const chooseDate = value => { setForm(current => ({ ...current, bookingDate: value })); setDateError(''); };
  const changeDate = event => {
    const value = event.target.value;
    setForm(current => ({ ...current, bookingDate: value }));
    if (value) {
      const [year, monthNumber] = value.split('-').map(Number);
      if (year && monthNumber) setMonth(new Date(year, monthNumber - 1, 1));
    }
    setDateError(blockedReason(value));
  };
  useEffect(() => {
    if (form.bookingDate && monthKey(month) === form.bookingDate.slice(0, 7)) setDateError(blockedReason(form.bookingDate));
    // Revalidate a manually entered date after its month data arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, form.bookingDate, month]);

  const openPicker = () => {
    const input = dateInput.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else { input.focus(); input.click(); }
  };
  const submit = async event => {
    event.preventDefault();
    if (eventBooking && !verifiedEvent) { setError('The selected event could not be verified for your account.'); return; }
    if (!eventBooking) { const blocked = blockedReason(form.bookingDate); if (blocked) { setDateError(blocked); return; } }
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(''); setSuccess('');
    try {
      if (eventBooking) {
        const data = await readJson(await apiFetch(`/events/${verifiedEvent.id}/bookings`, { method: 'POST', body: JSON.stringify({ modelId: talentId }) }));
        setSuccess(data.message || 'Booking request sent successfully.');
      } else {
        await readJson(await apiFetch('/direct-bookings', { method: 'POST', body: JSON.stringify({ ...form, talentId, talentRole }) }));
        navigate('/my-bookings', { state: { bookingSent: true } });
      }
    } catch (caught) { setError(caught.message); }
    finally { inFlight.current = false; setSaving(false); }
  };

  if (!permitted) return auth.status === 'unauthenticated' ? <button className="direct-booking-trigger" type="button" onClick={() => navigate('/login')}>Sign in to book</button> : null;
  return <div className="direct-booking-entry">
    <button className="direct-booking-trigger" type="button" onClick={() => setOpen(true)}>{eventBooking ? 'BOOK FOR THIS EVENT' : 'BOOK NOW'}</button>
    {open && <div className="direct-booking-modal" role="dialog" aria-modal="true" aria-labelledby="direct-booking-title"><form onSubmit={submit}>
      <div className="direct-booking-form-head"><div><p>{eventBooking ? 'AI match booking' : 'Direct booking'}</p><h2 id="direct-booking-title">Book {talentName}</h2></div><button type="button" aria-label="Close booking form" disabled={saving} onClick={() => setOpen(false)}>×</button></div>
      {error && <p className="direct-booking-error" role="alert">{error}</p>}
      {success && <p className="direct-booking-success" role="status">{success}</p>}
      {eventBooking ? <section className="direct-booking-locked-event" aria-label="Locked booking event"><p>Booking for</p>{eventLoading ? <span>Verifying your event...</span> : verifiedEvent ? <><strong>{verifiedEvent.title}</strong><span>{verifiedEvent.eventType}{verifiedEvent.location ? ` · ${verifiedEvent.location}` : ''}</span><small>This approved event is locked to the booking request.</small></> : <span>Event verification is required.</span>}</section> : <>
      <label>Job Type<select value={form.jobType} disabled={saving} onChange={event => setForm({ ...form, jobType: event.target.value })}>{jobs.map(job => <option key={job}>{job}</option>)}</select></label>
      <label>Booking Date<span className="direct-booking-date-field"><input ref={dateInput} required type="date" min={todayKey()} value={form.bookingDate} disabled={saving} aria-describedby={dateError ? 'direct-booking-date-error' : undefined} aria-invalid={Boolean(dateError)} onChange={changeDate} /><button type="button" aria-label="Open booking date picker" disabled={saving} onClick={openPicker}><span aria-hidden="true">▦</span></button></span></label>
      {dateError && <p id="direct-booking-date-error" className="direct-booking-field-error" role="alert">{dateError}</p>}

      <section className="direct-booking-calendar" aria-label={`${talentName} availability calendar`}>
        <div className="direct-booking-calendar-head"><button type="button" aria-label="Previous availability month" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>←</button><strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="Next availability month" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>→</button></div>
        {availabilityLoading ? <p className="direct-booking-calendar-message" role="status">Loading availability...</p> : availabilityError ? <p className="direct-booking-calendar-message direct-booking-field-error" role="alert">{availabilityError}</p> : <><div className="direct-booking-weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="direct-booking-calendar-grid">{calendarDays.map(entry => entry.empty ? <span key={entry.key} /> : <button type="button" key={entry.key} aria-label={`${entry.key}: ${entry.booked ? 'already booked' : entry.status === 'unavailable' ? 'manually unavailable' : entry.status === 'available' ? 'available' : 'not confirmed'}`} className={`${entry.booked ? 'is-booked' : entry.status ? `is-${entry.status}` : 'is-neutral'}${form.bookingDate === entry.key ? ' is-selected' : ''}`} disabled={entry.past || entry.booked || entry.status !== 'available'} onClick={() => chooseDate(entry.key)}>{entry.day}</button>)}</div></>}
        <div className="direct-booking-calendar-legend"><span><i className="is-available" />Available</span><span><i className="is-booked" />Booked</span><span><i className="is-unavailable" />Unavailable</span><span><i className="is-neutral" />Not confirmed</span></div>
      </section>

      <label>Location<input required maxLength="180" value={form.location} disabled={saving} onChange={event => setForm({ ...form, location: event.target.value })} /></label>
      <label>Short Job Description<textarea required maxLength="1500" rows="5" value={form.description} disabled={saving} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      </>}
      <button className="direct-booking-submit" disabled={saving || Boolean(dateError) || (eventBooking && (!verifiedEvent || Boolean(success)))}>{saving ? 'Sending...' : success ? 'REQUEST SENT' : 'SEND BOOKING REQUEST'}</button>
    </form></div>}
  </div>;
}
