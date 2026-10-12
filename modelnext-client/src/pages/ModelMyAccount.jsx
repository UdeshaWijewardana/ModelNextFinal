import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch, getCurrentUser, readJson, SERVER_BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import DashboardStatCard from "../components/client-dashboard/DashboardStatCard";
import SectionHeader from "../components/client-dashboard/SectionHeader";
import "../styles/ClientDashboard.css";
import "../styles/ModelAvailability.css";
import "../styles/ModelMyAccount.css";

const MODEL_PENDING_MESSAGE = "Your registration is pending administrator approval. You can view your submitted profile information. Editing will be available after approval.";
const PROFILE_FIELDS = [
  ["fullName", "Full name"],
  ["username", "Username"],
  ["address", "Address"],
  ["phone", "Phone"],
  ["birthdate", "Birthdate"],
  ["location", "Location"],
  ["gender", "Gender"],
  ["categories", "Categories"],
  ["weight", "Weight"],
  ["height", "Height"],
  ["waist", "Waist"],
  ["hip", "Hip"],
];
const NAV_ITEMS = [
  ["Overview", "⌂", "overview"],
  ["My Profile", "◉", "profile"],
  ["Portfolio", "▧", "portfolio"],
  ["Availability Calendar", "◷", "availability"],
  ["My Bookings", "▤", "bookings"],
  ["Private Messages", "◌", "private-messages"],
  ["Event Group Chats", "▣", "event-chats"],
  ["Notifications", "◔", "notifications"],
  ["Account Settings", "⚙", "settings"],
];

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const dayKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const imageUrl = (path) => !path
  ? ""
  : /^https?:\/\//i.test(path)
    ? path
    : `${SERVER_BASE_URL}/${String(path).replace(/\\/g, "/").replace(/^\/+/, "")}`;
const loadAllChatPages = async (path, field) => {
  const items = [];
  let cursor = null;
  do {
    const query = `?limit=100${cursor ? `&before=${encodeURIComponent(cursor)}` : ""}`;
    const page = await readJson(await apiFetch(`${path}${query}`));
    items.push(...(page[field] || []));
    cursor = page.nextCursor;
  } while (cursor);
  return items;
};

function ModelAvailabilityManager() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendar, setCalendar] = useState({ bookedDates: [], manualDates: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setCalendar(await readJson(await apiFetch(`/models/me/availability?month=${monthKey(month)}`)));
    } catch (requestError) {
      setError(requestError.message || "Unable to load availability.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const dates = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const today = dayKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const booked = new Set(calendar.bookedDates || []);
    const manual = new Map((calendar.manualDates || []).map((entry) => [entry.date, entry.status]));
    return [
      ...Array.from({ length: new Date(year, monthIndex, 1).getDay() }, (_, index) => ({ empty: true, key: `empty-${index}` })),
      ...Array.from({ length: new Date(year, monthIndex + 1, 0).getDate() }, (_, index) => {
        const date = dayKey(year, monthIndex, index + 1);
        return { date, day: index + 1, booked: booked.has(date), status: manual.get(date), past: date < today };
      }),
    ];
  }, [calendar, month]);

  const update = async (date, status) => {
    if (date < dayKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) return;
    setError("");
    try {
      if (status === "clear") {
        await readJson(await apiFetch(`/models/me/availability/${date}`, { method: "DELETE" }));
      } else {
        await readJson(await apiFetch(`/models/me/availability/${date}`, { method: "PUT", body: JSON.stringify({ status }) }));
      }
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to save availability.");
    }
  };

  return <section className="model-availability-manager" aria-labelledby="manage-availability-title">
    <div className="model-availability-heading">
      <div><p>Schedule preferences</p><h2 id="manage-availability-title">Manage Availability</h2></div>
      <div className="model-availability-legend">
        <span><i className="model-availability-dot is-available" />Available</span>
        <span><i className="model-availability-dot is-unavailable" />Unavailable</span>
        <span><i className="model-availability-dot is-booked" />Booked</span>
      </div>
    </div>
    {error && <p className="model-availability-error" role="alert">{error}</p>}
    <div className="model-availability-controls">
      <button type="button" aria-label="Previous month" onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>←</button>
      <strong>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
      <button type="button" aria-label="Next month" onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>→</button>
    </div>
    {loading ? <p>Loading calendar…</p> : <>
      <div className="model-availability-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="model-availability-grid">{dates.map((entry) => entry.empty
        ? <span key={entry.key} />
        : <div className={`model-availability-day${entry.booked ? " is-booked" : ""}${entry.status ? ` is-${entry.status}` : ""}${entry.past ? " is-past" : ""}`} key={entry.date}>
          <span>{entry.day}</span>
          {!entry.booked && !entry.past && <div className="model-availability-actions">
            <button type="button" onClick={() => update(entry.date, "available")}>Available</button>
            <button type="button" onClick={() => update(entry.date, "unavailable")}>Unavailable</button>
            {entry.status && <button type="button" onClick={() => update(entry.date, "clear")}>Clear</button>}
          </div>}
        </div>)}</div>
      <p className="model-availability-note">Confirmed bookings are locked and always take priority over your preferences. Past dates cannot be edited.</p>
    </>}
  </section>;
}

export default function ModelMyAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, restoreSession } = useAuth();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [bookings, setBookings] = useState({ sent: [], received: [] });
  const [eventInvitations, setEventInvitations] = useState([]);
  const [eventChats, setEventChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const requestedSection = new URLSearchParams(location.search).get("section") || "overview";
  const activeSection = NAV_ITEMS.some(([, , section]) => section === requestedSection) ? requestedSection : "overview";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { user: current } = await getCurrentUser();
      if (current.role !== "model") throw new Error("This account cannot access the Model My Account page.");
      setUser(current);
      setForm(current);

      if (current.approvalStatus === "approved") {
        const results = await Promise.allSettled([
          apiFetch("/notifications").then(readJson),
          apiFetch("/direct-bookings").then(readJson),
          loadAllChatPages("/event-chats/invitations/mine", "invitations"),
          loadAllChatPages("/event-chats/mine", "chats"),
        ]);
        if (results[0].status === "fulfilled") setNotifications(results[0].value.notifications || []);
        else setError(results[0].reason.message || "Unable to load notifications.");
        if (results[1].status === "fulfilled") setBookings(results[1].value);
        else setError((previous) => previous || results[1].reason.message || "Unable to load bookings.");
        if (results[2].status === "fulfilled") setEventInvitations(results[2].value);
        else setError((previous) => previous || results[2].reason.message || "Unable to load event invitations.");
        if (results[3].status === "fulfilled") setEventChats(results[3].value);
        else setError((previous) => previous || results[3].reason.message || "Unable to load event chats.");
      } else {
        setNotifications([]);
        setBookings({ sent: [], received: [] });
        setEventInvitations([]);
        setEventChats([]);
        setEditing(false);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load your Model account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  useEffect(() => {
    const target = document.getElementById(activeSection);
    target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    setSidebarOpen(false);
  }, [activeSection, loading]);

  const goTo = (section) => navigate({ search: `?section=${section}` });
  const backToWebsite = async () => {
    await restoreSession();
    navigate("/");
  };
  const signOut = async () => {
    await logout();
    navigate("/");
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    if (!user || user.approvalStatus !== "approved") return;
    setSaving(true);
    setError("");
    setNotice("");
    const changes = { ...form };
    if (typeof changes.categories === "string") {
      changes.categories = changes.categories.split(",").map((item) => item.trim()).filter(Boolean);
    }
    try {
      const { user: updated } = await readJson(await apiFetch("/auth/me/profile", {
        method: "PATCH",
        body: JSON.stringify(changes),
      }));
      setUser(updated);
      setForm(updated);
      setEditing(false);
      setNotice("Your profile changes have been saved.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };
  const markRead = async (id) => {
    try {
      await readJson(await apiFetch(`/notifications/${id}/read`, { method: "PATCH", body: "{}" }));
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, read: true } : item));
    } catch (requestError) {
      setError(requestError.message || "Unable to update the notification.");
    }
  };
  const respondToBooking = async (booking, status) => {
    setBusyAction(`booking:${booking.id}:${status}`);
    setError("");
    setNotice("");
    try {
      await readJson(await apiFetch(`/direct-bookings/${booking.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }));
      setNotice(status === "confirmed" ? "Booking request accepted." : "Booking request declined.");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to respond to the booking request.");
    } finally {
      setBusyAction("");
    }
  };
  const respondToInvitation = async (invitation, action) => {
    setBusyAction(`invitation:${invitation._id}:${action}`);
    setError("");
    setNotice("");
    try {
      await readJson(await apiFetch(`/event-chats/invitations/${invitation._id}/respond`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }));
      setNotice(action === "accept" ? "Event chat invitation accepted." : "Event chat invitation declined.");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to respond to the event invitation.");
    } finally {
      setBusyAction("");
    }
  };

  if (loading && !user) return <main className="client-dashboard-loading">Loading your Model account…</main>;
  if (!user) return <main className="client-dashboard-loading" role="alert">{error || "Your session has expired. Please sign in again."}</main>;

  const approved = user.approvalStatus === "approved";
  const pending = user.approvalStatus === "pending";
  const unreadCount = notifications.filter((item) => !item.read).length;
  const receivedBookings = bookings.received || [];
  const confirmedBookings = receivedBookings.filter((item) => item.status === "confirmed");
  const privateBookingConversations = receivedBookings.filter((item) => ["confirmed", "completed"].includes(item.status));
  const pendingBookings = receivedBookings.filter((item) => item.status === "pending");
  const otherBookings = receivedBookings.filter((item) => item.status !== "pending").slice(0, 5);
  const memberChatIds = new Set(eventChats.map((chat) => String(chat.id)));
  const portfolio = Array.isArray(user.portfolioImages) ? user.portfolioImages : [];
  const profileImage = imageUrl(user.profileImage);
  const fieldValue = (source, field) => Array.isArray(source[field]) ? source[field].join(", ") : source[field] || "";
  const notificationBooking = (item) => item.resourceType === "direct_booking" && item.resourceId
    ? receivedBookings.find((booking) => String(booking.id) === String(item.resourceId))
    : null;
  const notificationInvitation = (item) => item.resourceType === "event_chat_invitation" && item.resourceId
    ? eventInvitations.find((invitation) => String(invitation._id) === String(item.resourceId))
    : null;

  return <div className="client-dashboard-shell model-account-shell" id="dashboard-top">
    <aside className={`client-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Model account navigation">
      <div className="client-brand"><span className="client-brand-mark">M</span><span><span className="brand-model">Model</span><span className="brand-next">Next</span></span></div>
      <p className="client-sidebar-label">MODEL WORKSPACE</p>
      <nav className="client-nav-list">
        {NAV_ITEMS.map(([label, icon, section]) => {
          const restricted = ["availability", "bookings", "private-messages", "event-chats"].includes(section) && !approved;
          return <button key={section} type="button" disabled={restricted} aria-current={activeSection === section ? "page" : undefined} className={`client-nav-item ${activeSection === section ? "is-active" : ""}`} onClick={() => goTo(section)}>
            <span aria-hidden="true">{icon}</span><span>{label}</span>{section === "notifications" && unreadCount > 0 && <strong className="client-unread-count">{unreadCount}</strong>}
          </button>;
        })}
      </nav>
      <div className="client-sidebar-bottom">
        <button type="button" className="client-nav-item" onClick={backToWebsite}><span aria-hidden="true">←</span><span>Back to Website</span></button>
        <button type="button" className="client-nav-item" onClick={signOut}><span aria-hidden="true">↗</span><span>Logout</span></button>
      </div>
    </aside>
    {sidebarOpen && <button className="client-sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

    <main className="client-dashboard-main">
      <header className="client-topbar">
        <button type="button" className="client-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>☰</button>
        <div className="client-search"><span aria-hidden="true">⌂</span><strong>My Account</strong></div>
        <div className="client-topbar-actions">
          <button type="button" className="client-icon-button" aria-label="Notifications" onClick={() => goTo("notifications")}>◔{unreadCount > 0 && <i>{unreadCount}</i>}</button>
          {approved && <button type="button" className="client-icon-button" aria-label="Private Messages" onClick={() => goTo("private-messages")}>◌</button>}
          <div className="client-user-chip">
            {profileImage ? <img className="client-avatar model-account-avatar" src={profileImage} alt="" /> : <span className="client-avatar">{(user.fullName || "M").charAt(0).toUpperCase()}</span>}
            <span><strong>{user.fullName || user.name}</strong><small>Model</small></span>
          </div>
        </div>
      </header>

      {activeSection === "overview" && <section className="client-welcome" id="overview">
        <div><p className="client-eyebrow">MODEL WORKSPACE</p><h1>Welcome back, {user.fullName || user.name}</h1><p>Manage your profile, portfolio, schedule and professional bookings.</p></div>
        <span className={`model-account-status-chip is-${user.approvalStatus || "pending"}`}>{approved ? "Approved" : pending ? "Pending approval" : "Registration not approved"}</span>
      </section>}

      {pending && <section className="model-account-approval-banner" role="status"><strong>Pending Admin Approval</strong><p>{MODEL_PENDING_MESSAGE}</p></section>}
      {error && <p className="client-dashboard-error" role="alert">{error}</p>}
      {notice && <p className="client-dashboard-notice" role="status">{notice}</p>}

      {activeSection === "overview" && <section className="client-stat-grid" aria-label="Model account summary">
        <DashboardStatCard icon="◉" label="Profile status" value={approved ? "Approved" : pending ? "Pending" : "Review"} detail={approved ? "Professional features available" : "Profile is view-only"} onClick={() => goTo("profile")} />
        <DashboardStatCard icon="▧" label="Portfolio photos" value={portfolio.length} detail="Photos in your submitted portfolio" onClick={() => goTo("portfolio")} />
        <DashboardStatCard icon="▤" label="Received bookings" value={approved ? receivedBookings.length : "—"} detail={approved ? `${confirmedBookings.length} confirmed` : "Available after approval"} onClick={approved ? () => goTo("bookings") : undefined} />
        <DashboardStatCard icon="◔" label="Notifications" value={unreadCount} detail="Unread account notifications" onClick={() => goTo("notifications")} />
        {approved && <DashboardStatCard icon="▣" label="Event Group Chats" value={eventChats.length} detail={`${eventInvitations.filter((invitation) => invitation.status === "pending").length} pending invitations`} onClick={() => goTo("event-chats")} />}
        {approved && <DashboardStatCard icon="◌" label="Private Messages" value={privateBookingConversations.length} detail="Confirmed booking conversations" onClick={() => goTo("private-messages")} />}
      </section>}

      {activeSection === "profile" && <section className="client-panel model-account-panel" id="profile" tabIndex="-1">
        <SectionHeader eyebrow="MODEL ACCOUNT" title="My Profile" action={approved && !editing ? "Edit Profile" : undefined} onAction={() => setEditing(true)} />
        {editing && approved
          ? <form className="model-account-profile-form" onSubmit={saveProfile}>
            {PROFILE_FIELDS.map(([field, label]) => <label key={field}>{label}
              <input value={fieldValue(form, field)} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} />
            </label>)}
            <div className="model-account-form-actions">
              <button type="submit" className="client-primary-button" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
              <button type="button" className="client-secondary-button" onClick={() => { setForm(user); setEditing(false); }}>Cancel</button>
            </div>
          </form>
          : <div className="model-account-profile-grid">
            {PROFILE_FIELDS.map(([field, label]) => <article className="model-account-detail-card" key={field}><span>{label}</span><strong>{fieldValue(user, field) || "Not provided"}</strong></article>)}
            <article className="model-account-detail-card"><span>Email</span><strong>{user.email || "Not provided"}</strong></article>
            <article className="model-account-detail-card"><span>Skills</span><strong>{fieldValue(user, "skills") || "Not provided"}</strong></article>
            <article className="model-account-detail-card"><span>Document type</span><strong>{user.idType || "Not provided"}</strong></article>
          </div>}
        {!approved && <p className="model-account-readonly-note">Your submitted registration details are view-only until administrator approval.</p>}
      </section>}

      {activeSection === "portfolio" && <section className="client-panel model-account-panel" id="portfolio" tabIndex="-1">
        <SectionHeader eyebrow="YOUR WORK" title="Portfolio" />
        {portfolio.length
          ? <div className="model-account-portfolio-grid">{portfolio.map((image, index) => {
            const src = imageUrl(typeof image === "string" ? image : image?.url || image?.path);
            return src ? <article className="client-talent-card" key={`${src}-${index}`}><div className="client-talent-image"><img src={src} alt={`Portfolio image ${index + 1}`} loading="lazy" /></div></article> : null;
          })}</div>
          : <p className="model-account-empty">No portfolio photos have been added to your account.</p>}
        {!approved && <p className="model-account-readonly-note">Portfolio photos cannot be changed until administrator approval.</p>}
      </section>}

      <section className="client-panel model-account-panel" id="availability" tabIndex="-1" hidden={activeSection !== "availability" || !approved}>
        <SectionHeader eyebrow="SCHEDULE PREFERENCES" title="Availability Calendar" />
        {approved && <ModelAvailabilityManager />}
      </section>

      {approved && activeSection === "bookings" && <section className="client-panel model-account-panel" id="bookings" tabIndex="-1">
        <SectionHeader eyebrow="PROFESSIONAL WORK" title="Incoming Booking Requests" action="Open Bookings" onAction={() => navigate("/my-bookings")} />
        {!receivedBookings.length ? <p className="model-account-empty">No booking requests have been received yet.</p> : <div className="model-account-booking-list">
          {pendingBookings.map((booking) => <article key={booking.id}>
            <div><strong>{booking.jobType}</strong><span>From {booking.requesterName} · {booking.bookingDate} · {booking.location}</span><span>Status: {booking.status}</span></div>
            <div className="model-account-action-buttons">
              <Link to={`/my-bookings/${booking.id}`}>View Details</Link>
              <button type="button" disabled={Boolean(busyAction)} onClick={() => respondToBooking(booking, "confirmed")}>{busyAction === `booking:${booking.id}:confirmed` ? "Accepting…" : "Accept"}</button>
              <button type="button" className="is-danger" disabled={Boolean(busyAction)} onClick={() => respondToBooking(booking, "declined")}>{busyAction === `booking:${booking.id}:declined` ? "Declining…" : "Decline"}</button>
            </div>
          </article>)}
          {otherBookings.map((booking) => <article key={booking.id}>
            <div><strong>{booking.jobType}</strong><span>From {booking.requesterName} · {booking.bookingDate} · {booking.location}</span><span>Status: {booking.status}</span></div>
            <div className="model-account-action-buttons">
              <Link to={`/my-bookings/${booking.id}`}>View Details</Link>
              {["confirmed", "completed"].includes(booking.status) && <Link to={`/private-messages/${booking.id}`}>Open Private Chat</Link>}
            </div>
          </article>)}
        </div>}
        <Link className="model-account-text-link" to="/my-bookings">View and respond to your booking requests</Link>
      </section>}

      {approved && activeSection === "event-chats" && <section className="client-panel model-account-panel" id="event-chats" tabIndex="-1">
        <SectionHeader eyebrow="EVENT COLLABORATION" title="Event Group Chats" />
        <section className="model-account-subsection" aria-labelledby="joined-event-chats-title">
          <h3 id="joined-event-chats-title">Joined Group Chats</h3>
          {!eventChats.length ? <p className="model-account-empty">You have not joined any event group chats yet.</p> : <div className="model-account-booking-list">
            {eventChats.map((chat) => <article key={chat.id}>
              <div><strong>{chat.eventTitle || "Event group chat"}</strong><span>{chat.isOwner ? "Organizer" : "Member"}</span></div>
              <Link to={`/event-chats/${chat.id}`}>Open Chat</Link>
            </article>)}
          </div>}
        </section>
        <section className="model-account-subsection" aria-labelledby="pending-event-invitations-title">
          <h3 id="pending-event-invitations-title">Pending Invitations</h3>
          {eventInvitations.filter((invitation) => invitation.status === "pending").length === 0
            ? <p className="model-account-empty">No pending event chat invitations.</p>
            : <div className="model-account-booking-list">
              {eventInvitations.filter((invitation) => invitation.status === "pending").map((invitation) => <article key={invitation._id}>
                <div><strong>{invitation.chat?.eventTitle || "Unavailable event"}</strong><span>Invitation pending</span></div>
                <div className="model-account-action-buttons">
                  {invitation.chat?.available && <>
                    <button type="button" disabled={Boolean(busyAction)} onClick={() => respondToInvitation(invitation, "accept")}>{busyAction === `invitation:${invitation._id}:accept` ? "Accepting…" : "Accept"}</button>
                    <button type="button" className="is-danger" disabled={Boolean(busyAction)} onClick={() => respondToInvitation(invitation, "decline")}>{busyAction === `invitation:${invitation._id}:decline` ? "Declining…" : "Decline"}</button>
                  </>}
                </div>
              </article>)}
            </div>}
        </section>
      </section>}

      {approved && activeSection === "private-messages" && <section className="client-panel model-account-panel" id="private-messages" tabIndex="-1">
        <SectionHeader eyebrow="PRIVATE CONVERSATIONS" title="Private Messages" />
        {!privateBookingConversations.length ? <p className="model-account-empty">Confirmed booking conversations will appear here.</p> : <div className="model-account-booking-list">
          {privateBookingConversations.map((booking) => <article key={booking.id}>
            <div><strong>{booking.jobType}</strong><span>With {booking.requesterName} · {booking.bookingDate} · {booking.status}</span></div>
            <Link to={`/private-messages/${booking.id}`}>Open Private Chat</Link>
          </article>)}
        </div>}
      </section>}

      {activeSection === "notifications" && <section className="client-panel model-account-panel" id="notifications" tabIndex="-1">
        <SectionHeader eyebrow="ACCOUNT UPDATES" title="Notifications" />
        {pending && <article className="model-account-notification"><strong>Pending administrator approval</strong><p>{MODEL_PENDING_MESSAGE}</p></article>}
        {notifications.length
          ? notifications.map((item) => {
            const booking = notificationBooking(item);
            const invitation = notificationInvitation(item);
            return <article className="model-account-notification" key={item._id}>
              <div><strong>{item.message}{invitation?.chat?.eventTitle ? ` · ${invitation.chat.eventTitle}` : ""}</strong>{item.createdAt && <time>{new Date(item.createdAt).toLocaleString()}</time>}
                {item.resourceType === "direct_booking" && booking && <div className="model-account-action-buttons">
                  <Link to={`/my-bookings/${booking.id}`}>Open Booking</Link>
                  {item.type === "direct_booking_requested" && booking.status === "pending" && <>
                    <button type="button" disabled={Boolean(busyAction)} onClick={() => respondToBooking(booking, "confirmed")}>Accept</button>
                    <button type="button" className="is-danger" disabled={Boolean(busyAction)} onClick={() => respondToBooking(booking, "declined")}>Decline</button>
                  </>}
                  {["confirmed", "completed"].includes(booking.status) && <Link to={`/private-messages/${booking.id}`}>Open Private Chat</Link>}
                </div>}
                {item.type === "chat_invitation_received" && invitation?.status === "pending" && invitation.chat?.available && <div className="model-account-action-buttons">
                  <button type="button" disabled={Boolean(busyAction)} onClick={() => respondToInvitation(invitation, "accept")}>Accept</button>
                  <button type="button" className="is-danger" disabled={Boolean(busyAction)} onClick={() => respondToInvitation(invitation, "decline")}>Decline</button>
                </div>}
                {item.type === "chat_invitation_received" && invitation?.status === "accepted" && invitation.chat?.available && memberChatIds.has(String(invitation.chatId)) && <Link to={`/event-chats/${invitation.chatId}`}>Open Group Chat</Link>}
              </div>
              <button type="button" className="client-text-button" disabled={item.read} onClick={() => markRead(item._id)}>{item.read ? "Read" : "Mark read"}</button>
            </article>;
          })
          : !pending && <p className="model-account-empty">No notifications.</p>}
      </section>}

      {activeSection === "settings" && <section className="client-panel model-account-panel" id="settings" tabIndex="-1">
        <SectionHeader eyebrow="ACCOUNT" title="Account Settings" />
        <div className="model-account-settings-row"><span>Email address</span><strong>{user.email}</strong></div>
        <div className="model-account-settings-row"><span>Approval status</span><strong>{approved ? "Approved" : pending ? "Pending administrator approval" : user.approvalStatus}</strong></div>
        {approved && <button type="button" className="client-secondary-button" onClick={() => { setEditing(true); goTo("profile"); }}>Edit profile details</button>}
      </section>}

      <footer className="model-account-footer">
        <Link to="/">Back to Website</Link>
        <button type="button" onClick={signOut}>Logout</button>
      </footer>
    </main>
  </div>;
}
