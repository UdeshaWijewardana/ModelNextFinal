import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import EventChatAction from "../event-chat/EventChatAction";
import Navbar from "../components/Navbar";
import { apiFetch, getCurrentUser, readJson } from "../api";

export default function Events() {
  const navigate = useNavigate(); const [events, setEvents] = useState([]); const [user, setUser] = useState(null); const [requests, setRequests] = useState([]); const [error, setError] = useState("");
  const load = async () => { try { const { events: listed } = await readJson(await apiFetch("/events")); setEvents(listed); try { const { user: current } = await getCurrentUser(); setUser(current); const { requests: mine } = await readJson(await apiFetch("/events/requests/mine")); setRequests(mine); } catch (_ignored) { setUser(null); setRequests([]); } } catch (err) { setError(err.message); } };
  useEffect(() => { load(); }, []);
  const join = async (id) => { if (!user) return navigate("/login"); try { await readJson(await apiFetch(`/events/${id}/requests`, { method: "POST", body: "{}" })); load(); } catch (err) { setError(err.message); } };
  const requestStatus = (id) => requests.find((item) => item.eventId === id)?.status;
  return <><Navbar /><main style={{ maxWidth: 1000, margin: "0 auto", padding: "120px 40px 80px" }}><h1>Events</h1>{error && <p style={{ color: "#b00020" }}>{error}</p>}{user && user.role !== "model" && <button onClick={() => navigate("/event/create")}>Create event</button>}{events.length === 0 ? <p>No approved events are available.</p> : events.map((event) => <article key={event.id} style={{ border: "1px solid #ddd", padding: 20, margin: "15px 0" }}><h2>{event.title}</h2><p>{event.eventType} · {event.location}</p><p>{event.description}</p>{["model", "photographer"].includes(user?.role) && <button disabled={Boolean(requestStatus(event.id))} onClick={() => join(event.id)}>{requestStatus(event.id) || "Request to join"}</button>}<EventChatAction eventId={event.id}/></article>)}</main></>;
}
