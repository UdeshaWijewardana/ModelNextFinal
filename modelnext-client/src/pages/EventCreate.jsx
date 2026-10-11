import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { apiFetch, getCurrentUser, readJson } from '../api';
import { accountRouteForRole } from '../context/AuthContext';
import '../styles/MyEvents.css';

const initialForm = { title: '', eventType: 'Runway', startDate: '', endDate: '', location: '', description: '', image: '', requiredGender: '', minAge: '', maxAge: '', minHeight: '', maxHeight: '', requiredCategories: '', requiredSkills: '' };
const localDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const list = value => value.split(',').map(item => item.trim()).filter(Boolean);

export default function EventCreate() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setUser(null); setForm(initialForm); setError('');
    (async () => {
      try {
        const { user: current } = await getCurrentUser();
        if (!active) return;
        if (eventId) {
          const { event } = await readJson(await apiFetch(`/events/mine/${eventId}`));
          if (!active) return;
          setForm(Object.fromEntries(Object.keys(initialForm).map(key => [key,
            key.includes('Date') ? localDateTime(event[key]) : Array.isArray(event[key]) ? event[key].join(', ') : event[key] ?? '',
          ])));
        }
        setUser(current);
      } catch (caught) { if (active) setError(caught.message); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [eventId]);
  const submit = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError('');
    try {
      const payload = { ...form, startDate: new Date(form.startDate).toISOString(), endDate: form.endDate ? new Date(form.endDate).toISOString() : '', requiredCategories: list(form.requiredCategories), requiredSkills: list(form.requiredSkills) };
      const { event: saved } = await readJson(await apiFetch(eventId ? `/events/${eventId}` : '/events', { method: eventId ? 'PATCH' : 'POST', body: JSON.stringify(payload) }));
      navigate(`/account/events/${saved.id}`, { replace: true });
    } catch (caught) { setError(caught.message); }
    finally { inFlight.current = false; setSaving(false); }
  };
  const allowed = user && ['client', 'photographer', 'agency'].includes(user.role) && (user.role === 'client' || user.approvalStatus === 'approved');
  const labels = { title: 'Event title', eventType: 'Event type', startDate: 'Start date and time', endDate: 'End date and time', location: 'Location', description: 'Description', image: 'Event image URL or path', requiredGender: 'Gender requirement', minAge: 'Minimum age', maxAge: 'Maximum age', minHeight: 'Minimum height', maxHeight: 'Maximum height', requiredCategories: 'Categories (comma separated)', requiredSkills: 'Skills (comma separated)' };
  return <><Navbar /><main className="event-editor">
    {loading ? <p role="status">Loading account...</p> : <>
      <Link to={eventId ? `/account/events/${eventId}` : `${accountRouteForRole(user?.role)}?section=my-events`}>Back to {eventId ? 'Event details' : 'My Events'}</Link>
      <h1>{eventId ? 'Edit Event' : 'Create Event'}</h1>
      {error && <p role="alert">{error}</p>}
      {!allowed ? <p>An approved client, photographer, or agency account is required. <Link to="/login">Sign in</Link></p> :
        <form onSubmit={submit}>{Object.entries(form).map(([field, value]) => <label key={field}>{labels[field]}
          {field === 'description' ? <textarea required value={value} disabled={saving} onChange={e => setForm({ ...form, [field]: e.target.value })} /> :
            <input required={['title', 'eventType', 'startDate', 'location'].includes(field)} type={field.includes('Date') ? 'datetime-local' : /^(min|max)/.test(field) ? 'number' : 'text'} min={/^(min|max)/.test(field) ? '0' : undefined} value={value} disabled={saving} onChange={e => setForm({ ...form, [field]: e.target.value })} />}
        </label>)}<button disabled={saving}>{saving ? 'Saving...' : eventId ? 'Save Event' : 'Submit for approval'}</button></form>}
    </>}
  </main></>;
}
