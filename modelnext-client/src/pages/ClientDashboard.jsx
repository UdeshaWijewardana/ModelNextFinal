import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getCurrentUser, readJson } from "../api";
import ClientSidebar from "../components/client-dashboard/ClientSidebar";
import DashboardStatCard from "../components/client-dashboard/DashboardStatCard";
import SectionHeader from "../components/client-dashboard/SectionHeader";
import "../styles/ClientDashboard.css";

const initialProject = { title: "", eventType: "Event", startDate: "", endDate: "", location: "", description: "", requiredGender: "", minAge: "", maxAge: "", minHeight: "", maxHeight: "", requiredCategories: "", requiredSkills: "" };
const bookingFilters = ["All", "Upcoming", "Ongoing", "Completed", "Cancelled"];
const listValue = (value) => value.split(",").map((item) => item.trim()).filter(Boolean);
const imageUrl = (path) => path ? (path.startsWith("http") ? path : `http://localhost:5000/${path.replace(/\\/g, "/")}`) : "";
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Date to be confirmed";

const projectState = (event, now = new Date()) => {
  if (event.status === "rejected") return "Cancelled";
  const start = new Date(event.startDate);
  const end = new Date(event.endDate || event.startDate);
  if (Number.isNaN(start.getTime())) return "All";
  if (end < now) return "Completed";
  if (start > now) return "Upcoming";
  return "Ongoing";
};

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [publicEvents, setPublicEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationEvent, setRecommendationEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [error, setError] = useState("");
  const [recommendationError, setRecommendationError] = useState("");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [bookingFilter, setBookingFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [projectForm, setProjectForm] = useState(initialProject);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");

  const loadRecommendations = useCallback(async (items) => {
    const target = items.find((event) => event.status !== "rejected") || items[0];
    setRecommendations([]);
    setRecommendationEvent(target || null);
    setRecommendationError("");
    if (!target) return;
    setRecommendationLoading(true);
    try {
      const data = await readJson(await apiFetch(`/matching/events/${target.id}/models`));
      setRecommendations(data.matches || []);
      setRecommendationEvent(data.event || target);
    } catch (err) {
      setRecommendationError(err.message || "Recommendations are unavailable right now.");
    } finally {
      setRecommendationLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ user: current }, mine, notificationData, listed] = await Promise.all([
        getCurrentUser(),
        readJson(await apiFetch("/events/mine")),
        readJson(await apiFetch("/notifications")),
        readJson(await apiFetch("/events")),
      ]);
      if (current.role !== "client") throw new Error("This account cannot access the client portal.");
      const ownedEvents = mine.events || [];
      setUser(current);
      setEvents(ownedEvents);
      setRequests(mine.requests || []);
      setNotifications(notificationData.notifications || []);
      setPublicEvents(listed.events || []);
      await loadRecommendations(ownedEvents);
    } catch (err) {
      setError(err.message || "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [loadRecommendations]);

  useEffect(() => { load(); }, [load]);

  const createProject = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      await readJson(await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify({
          ...projectForm,
          requiredGender: projectForm.requiredGender || undefined,
          minAge: projectForm.minAge === "" ? undefined : Number(projectForm.minAge),
          maxAge: projectForm.maxAge === "" ? undefined : Number(projectForm.maxAge),
          minHeight: projectForm.minHeight === "" ? undefined : Number(projectForm.minHeight),
          maxHeight: projectForm.maxHeight === "" ? undefined : Number(projectForm.maxHeight),
          requiredCategories: listValue(projectForm.requiredCategories),
          requiredSkills: listValue(projectForm.requiredSkills),
        }),
      }));
      setProjectForm(initialProject);
      setCreateOpen(false);
      setNotice("Project submitted through the existing event workflow.");
      await load();
    } catch (err) {
      setError(err.message || "Could not create this project.");
    } finally {
      setCreating(false);
    }
  };

  const reviewRequest = async (id, status) => {
    try {
      await readJson(await apiFetch(`/events/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }));
      await load();
    } catch (err) { setError(err.message); }
  };

  const markRead = async (id) => {
    try {
      await readJson(await apiFetch(`/notifications/${id}/read`, { method: "PATCH", body: "{}" }));
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, read: true } : item));
    } catch (err) { setError(err.message); }
  };

  const goTo = (target) => {
    setActiveNav(target);
    setSidebarOpen(false);
    if (target === "discover") return navigate("/models");
    if (target === "events") return navigate("/events");
    if (target === "recommendations" && recommendationEvent?.id) return navigate(`/client-portal/ai-matches/${recommendationEvent.id}`);
    if (target === "settings") return setNotice("Client profile settings are not exposed by the current profile API.");
    if (target === "saved") return document.getElementById("saved-talent")?.scrollIntoView({ behavior: "smooth" });
    document.getElementById(target === "dashboard" ? "dashboard-top" : target)?.scrollIntoView({ behavior: "smooth" });
  };

  const now = new Date();
  const activeProjects = events.filter((event) => event.status !== "rejected" && projectState(event, now) !== "Completed").length;
  const filteredProjects = useMemo(() => {
    const filterTime = new Date();
    return events
      .filter((event) => bookingFilter === "All" || projectState(event, filterTime) === bookingFilter)
      .filter((event) => `${event.title} ${event.eventType} ${event.location}`.toLowerCase().includes(query.toLowerCase()));
  }, [events, bookingFilter, query]);
  const visibleRecommendations = recommendations.filter((model) => `${model.fullName} ${model.location} ${(model.categories || []).join(" ")} ${(model.skills || []).join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const activity = useMemo(() => [
    ...notifications.map((item) => ({ id: `note-${item._id}`, date: item.createdAt, text: item.message, unread: !item.read, notificationId: item._id })),
    ...events.map((event) => ({ id: `event-${event.id}`, date: event.createdAt, text: `Project created: ${event.title}`, unread: false })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), [notifications, events]);

  if (loading) return <main className="client-dashboard-loading">Loading your client workspace…</main>;
  if (!user) return <main className="client-dashboard-loading">{error || "Your session has expired. Please sign in again."}</main>;

  return <div className="client-dashboard-shell" id="dashboard-top">
    <ClientSidebar isOpen={isSidebarOpen} active={activeNav} onNavigate={goTo} unreadCount={unreadCount} />
    {isSidebarOpen && <button className="client-sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <main className="client-dashboard-main">
      <header className="client-topbar">
        <button type="button" className="client-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>☰</button>
        <label className="client-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for models, photographers, events or projects..." /></label>
        <div className="client-topbar-actions"><button type="button" className="client-icon-button" aria-label="Notifications" onClick={() => goTo("notifications")}>◔{unreadCount > 0 && <i>{unreadCount}</i>}</button><button type="button" className="client-icon-button" aria-label="Messages" onClick={() => goTo("messages")}>◌</button><div className="client-user-chip"><span className="client-avatar">{(user.name || "C").charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>Client</small></span></div></div>
      </header>

      <section className="client-welcome"><div><p className="client-eyebrow">CLIENT WORKSPACE</p><h1>Welcome back, {user.name}</h1><p>Find the right talent, manage your projects and bring your vision to life.</p></div><button type="button" className="client-primary-button" onClick={() => setCreateOpen(true)}>＋ Create New Project</button></section>
      {error && <p className="client-dashboard-error" role="alert">{error}</p>}{notice && <p className="client-dashboard-notice" role="status">{notice}</p>}

      <section className="client-stat-grid" aria-label="Project summary">
        <DashboardStatCard icon="▣" label="Active Projects" value={activeProjects} detail="Derived from your current event projects" onClick={() => goTo("projects")} />
        <DashboardStatCard icon="✓" label="Total Bookings" value="—" detail="Confirmed booking totals are not exposed by the current API" onClick={() => goTo("bookings")} />
        <DashboardStatCard icon="♡" label="Saved Talent" value="—" detail="Saved-talent persistence is not available yet" onClick={() => goTo("saved")} />
        <DashboardStatCard icon="✦" label="AI Recommendations" value={recommendationEvent ? recommendations.length : "—"} detail={recommendationEvent ? `For ${recommendationEvent.title}` : "Create a project to receive matches"} onClick={() => goTo("recommendations")} />
      </section>

      <div className="client-dashboard-columns">
        <section className="client-panel client-recommendations" id="recommendations"><SectionHeader eyebrow="AI MATCHING" title="Recommended Talent for You" action="View All" onAction={() => goTo("recommendations")} />
          {recommendationLoading ? <p className="client-empty">Finding suitable approved talent…</p> : recommendationError ? <p className="client-empty">{recommendationError}</p> : !recommendationEvent ? <p className="client-empty">Create a project with talent requirements to receive AI recommendations.</p> : visibleRecommendations.length === 0 ? <p className="client-empty">No recommendations are available for this project yet.</p> : <div className="client-talent-grid">{visibleRecommendations.map((model) => <article className="client-talent-card" key={model.id}><div className="client-talent-image">{imageUrl(model.profileImage) ? <img src={imageUrl(model.profileImage)} alt={model.fullName} /> : <span>{model.fullName?.charAt(0) || "M"}</span>}<strong>{model.matchScore}% match</strong></div><div><h3>{model.fullName}</h3><p>{(model.categories || ["Model"]).join(" · ")}</p><small>{model.location || "Location not listed"}</small><div className="client-tags">{(model.skills || []).slice(0, 2).map((skill) => <span key={skill}>{skill}</span>)}</div><button type="button" className="client-text-button" onClick={() => navigate(`/profile?${new URLSearchParams({ name: model.fullName || "Model", role: (model.categories || ["Fashion model"]).join(", "), img: imageUrl(model.profileImage), location: model.location || "" })}`)}>View Profile <span>→</span></button></div></article>)}</div>}
        </section>

        <aside className="client-right-rail">
          <section className="client-panel client-activity" id="notifications"><SectionHeader eyebrow="LIVE UPDATES" title="Recent Activity" />{activity.length === 0 ? <p className="client-empty">No recent activity.</p> : activity.map((item) => <button type="button" className={`client-activity-row ${item.unread ? "is-unread" : ""}`} key={item.id} onClick={() => item.notificationId && markRead(item.notificationId)}><span className="client-activity-dot" /><span>{item.text}<small>{formatDate(item.date)}{item.unread ? " · New" : ""}</small></span></button>)}</section>
          <section className="client-panel client-events-preview"><SectionHeader eyebrow="EVENTS" title="Opportunities" action="View All" onAction={() => navigate("/events")} />{publicEvents.slice(0, 3).map((event) => <button type="button" className="client-opportunity" key={event.id} onClick={() => navigate("/events")}><strong>{event.title}</strong><span>{event.eventType} · {event.location}</span><small>{formatDate(event.startDate)}</small></button>)}{publicEvents.length === 0 && <p className="client-empty">No approved events available.</p>}</section>
        </aside>
      </div>

      <section className="client-panel client-projects" id="bookings"><SectionHeader eyebrow="PROJECT LEDGER" title="All Bookings" /><p className="client-panel-caption">Derived from the existing Event and EventRequest workflow. Completed projects remain visible here; confirmed booking totals are not currently exposed by the API.</p><div className="client-filter-bar">{bookingFilters.map((filter) => <button type="button" key={filter} className={bookingFilter === filter ? "is-selected" : ""} onClick={() => setBookingFilter(filter)}>{filter}</button>)}</div><div className="client-project-list">{filteredProjects.length === 0 ? <p className="client-empty">{bookingFilter === "Completed" ? "No completed work yet." : "No projects match this view."}</p> : filteredProjects.map((event) => { const requestCount = requests.filter((request) => request.eventId === event.id).length; const state = projectState(event, now); return <article className="client-project-row" key={event.id}><div><span className={`client-status client-status-${state.toLowerCase()}`}>{state === "Cancelled" ? "Rejected" : state}</span><h3>{event.title}</h3><p>{event.eventType} · {event.location}</p></div><div className="client-project-meta"><span>{formatDate(event.startDate)}</span><span>{requestCount ? `${requestCount} pending talent request${requestCount === 1 ? "" : "s"}` : "No pending talent requests"}</span></div><div className="client-project-actions"><button type="button" className="client-secondary-button" onClick={() => navigate(`/client-portal/ai-matches/${event.id}`)}>View matches</button></div></article>; })}</div></section>

      <div className="client-bottom-grid"><section className="client-panel" id="messages"><SectionHeader eyebrow="COMMUNICATION" title="Messages" /><p className="client-empty">Event group chat is not available in the current application yet. This area is ready for the existing messaging API when it is introduced.</p></section><section className="client-panel" id="saved-talent"><SectionHeader eyebrow="SHORTLIST" title="Saved Talent" /><p className="client-empty">Saved-talent persistence is not available in the current application. Discover approved models and photographers from the existing directory.</p><button type="button" className="client-text-button" onClick={() => navigate("/models")}>Discover models <span>→</span></button><button type="button" className="client-text-button" onClick={() => navigate("/photographers")}>Discover photographers <span>→</span></button></section></div>

      <section className="client-panel client-requests" id="projects"><SectionHeader eyebrow="PENDING REVIEW" title="Participation Requests" />{requests.length === 0 ? <p className="client-empty">No pending participation requests.</p> : requests.map((request) => <div className="client-request-row" key={request.id}><span><strong>{request.requesterRole}</strong> requested to join <strong>{request.eventTitle}</strong></span><span><button type="button" className="client-mini-primary" onClick={() => reviewRequest(request.id, "confirmed")}>Approve</button><button type="button" className="client-mini-secondary" onClick={() => reviewRequest(request.id, "declined")}>Decline</button></span></div>)}</section>
    </main>

    {isCreateOpen && <div className="client-modal-backdrop" role="presentation"><section className="client-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title"><button type="button" className="client-modal-close" aria-label="Close" onClick={() => setCreateOpen(false)}>×</button><p className="client-eyebrow">EXISTING EVENT WORKFLOW</p><h2 id="create-project-title">Create New Project</h2><form onSubmit={createProject}><div className="client-modal-grid"><label>Project name<input required value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} /></label><label>Project type<select value={projectForm.eventType} onChange={(event) => setProjectForm({ ...projectForm, eventType: event.target.value })}><option>Event</option><option>Runway</option><option>Editorial</option><option>Commercial</option></select></label><label>Start date<input required type="datetime-local" value={projectForm.startDate} onChange={(event) => setProjectForm({ ...projectForm, startDate: event.target.value })} /></label><label>End date<input type="datetime-local" value={projectForm.endDate} onChange={(event) => setProjectForm({ ...projectForm, endDate: event.target.value })} /></label><label>Location<input required value={projectForm.location} onChange={(event) => setProjectForm({ ...projectForm, location: event.target.value })} /></label><label>Required gender<select value={projectForm.requiredGender} onChange={(event) => setProjectForm({ ...projectForm, requiredGender: event.target.value })}><option value="">Any gender</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label><label>Minimum age<input type="number" min="0" value={projectForm.minAge} onChange={(event) => setProjectForm({ ...projectForm, minAge: event.target.value })} /></label><label>Maximum age<input type="number" min="0" value={projectForm.maxAge} onChange={(event) => setProjectForm({ ...projectForm, maxAge: event.target.value })} /></label><label>Minimum height (cm)<input type="number" min="0" value={projectForm.minHeight} onChange={(event) => setProjectForm({ ...projectForm, minHeight: event.target.value })} /></label><label>Maximum height (cm)<input type="number" min="0" value={projectForm.maxHeight} onChange={(event) => setProjectForm({ ...projectForm, maxHeight: event.target.value })} /></label><label>Categories<label className="client-field-note">Comma separated</label><input value={projectForm.requiredCategories} onChange={(event) => setProjectForm({ ...projectForm, requiredCategories: event.target.value })} /></label><label>Skills<label className="client-field-note">Comma separated</label><input value={projectForm.requiredSkills} onChange={(event) => setProjectForm({ ...projectForm, requiredSkills: event.target.value })} /></label></div><label>Description<textarea required value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} /></label><button className="client-primary-button" disabled={creating}>{creating ? "Submitting…" : "Create Project"}</button></form></section></div>}
  </div>;
}
