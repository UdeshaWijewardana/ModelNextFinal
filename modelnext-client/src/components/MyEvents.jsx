import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, readJson } from '../api';
import '../styles/MyEvents.css';

export const eventDateTime = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Date not set';
};

export default function MyEvents({ events: suppliedEvents, onCreate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(suppliedEvents === undefined);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (suppliedEvents !== undefined) return undefined;
    const controller = new AbortController();
    setLoading(true); setError('');
    apiFetch('/events/mine', { signal: controller.signal }).then(readJson)
      .then(data => { if (!controller.signal.aborted) setEvents(data.events || []); })
      .catch(caught => { if (!controller.signal.aborted) setError(caught.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [suppliedEvents, revision]);
  const items = suppliedEvents === undefined ? events : suppliedEvents;
  return <section className="my-events" id="my-events" tabIndex="-1" aria-labelledby="my-events-title">
    <header className="my-events-heading"><h2 id="my-events-title">My Events</h2>
      {onCreate ? <button type="button" onClick={onCreate}>Create Event</button> : <Link to="/event/create">Create Event</Link>}
    </header>
    {loading ? <p role="status">Loading your events...</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div> : !items.length ? <p>You have not created any events yet.</p> :
      <div className="my-events-list">{items.map(event => <article key={event.id}>
        <h3>{event.title}</h3><p>{eventDateTime(event.startDate)}{event.endDate ? ` – ${eventDateTime(event.endDate)}` : ''}</p>
        <p>{event.location || 'Location not set'}</p><p>Approval: <strong>{event.status || 'pending'}</strong></p>
        <Link to={`/account/events/${event.id}`}>View Details</Link>
      </article>)}</div>}
  </section>;
}
