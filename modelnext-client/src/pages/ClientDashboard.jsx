import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getCurrentUser, logout, readJson } from "../api";

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null); const [events, setEvents] = useState([]); const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState(""); const [startDate, setStartDate] = useState(""); const [error, setError] = useState("");
  const load = async () => { try { const [{ user: current }, mine] = await Promise.all([getCurrentUser(), readJson(await apiFetch("/events/mine"))]); if (current.role !== "client") throw new Error("This account cannot access the client portal."); setUser(current); setEvents(mine.events); setRequests(mine.requests); } catch (err) { setError(err.message); } };
  useEffect(() => { load(); }, []);
  const create = async (e) => { e.preventDefault(); try { await readJson(await apiFetch("/events", { method: "POST", body: JSON.stringify({ title, eventType: "Event", startDate, location: "To be confirmed", description: title }) })); setTitle(""); setStartDate(""); load(); } catch (err) { setError(err.message); } };
  const review = async (id, status) => { try { await readJson(await apiFetch(`/events/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) })); load(); } catch (err) { setError(err.message); } };
  const remove = async (id) => { try { await readJson(await apiFetch(`/events/${id}`, { method: "DELETE" })); load(); } catch (err) { setError(err.message); } };
  if (!user) return <main style={{ padding: 40 }}>{error || "Loading account..."}</main>;
  return <main style={{ maxWidth: 850, margin: "40px auto" }}><h1>Client Portal</h1><p>{user.name}</p>{error && <p style={{ color: "#b00020" }}>{error}</p>}
    <form onSubmit={create}><input required placeholder="Event name" value={title} onChange={(e) => setTitle(e.target.value)} /><input required type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><button>Create event</button></form>
    <h2>Participation requests</h2>{requests.map((request) => <p key={request.id}>{request.requesterRole} requested {request.eventTitle} <button onClick={() => review(request.id, "confirmed")}>Approve</button><button onClick={() => review(request.id, "declined")}>Decline</button></p>)}
    <h2>My events</h2>{events.map((event) => <p key={event.id}>{event.title} — {event.status} <button onClick={() => remove(event.id)}>Delete</button></p>)}
    <button onClick={async () => { await logout(); navigate("/login"); }}>Logout</button>
  </main>;
}
