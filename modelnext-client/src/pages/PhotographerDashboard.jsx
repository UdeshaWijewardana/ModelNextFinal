
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  apiFetch,
  getCurrentUser,
  readJson,
  SERVER_BASE_URL,
} from "../api";

import { useAuth } from "../context/AuthContext";
import DashboardStatCard from "../components/client-dashboard/DashboardStatCard";
import SectionHeader from "../components/client-dashboard/SectionHeader";
import BrowseTalentLinks from "../components/BrowseTalentLinks";
import MyEvents from "../components/MyEvents";

import "../styles/ClientDashboard.css";
import "../styles/ModelAvailability.css";
import "../styles/ModelMyAccount.css";
import "../styles/PhotographerDashboard.css";

const PROFILE_FIELDS = [
  ["name", "Full name"],
  ["username", "Username"],
  ["phone", "Contact number"],
  ["location", "Location"],
  ["experienceYears", "Experience (years)"],
  ["portfolio", "Portfolio website"],
];

const NAV_ITEMS = [
  ["Overview", "⌂", "overview"],
  ["My Profile", "◉", "profile"],
  ["Portfolio", "▧", "portfolio"],
  ["Availability", "◷", "availability"],
  ["My Events", "□", "my-events"],
  ["My Bookings", "▤", "bookings"],
  ["Private Messages", "◌", "messages"],
  ["Notifications", "◔", "notifications"],
  ["Account Settings", "⚙", "settings"],
];

const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const dayKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const imageUrl = (value) =>
  !value
    ? ""
    : /^https?:\/\//i.test(value)
      ? value
      : `${SERVER_BASE_URL}/${String(value).replace(/^[\\/]+/, "")}`;

const safeWebsite = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
};

function PhotographerAvailabilityManager() {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [calendar, setCalendar] = useState({
    bookedDates: [],
    manualDates: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await readJson(
        await apiFetch(
          `/photographers/me/availability?month=${monthKey(month)}`
        )
      );
      setCalendar(result);
    } catch (requestError) {
      setError(requestError.message || "Unable to load availability.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const dates = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();

    const today = dayKey(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    );

    const booked = new Set(calendar.bookedDates || []);
    const manual = new Map(
      (calendar.manualDates || []).map((entry) => [
        entry.date,
        entry.status,
      ])
    );

    return [
      ...Array.from(
        { length: new Date(year, monthIndex, 1).getDay() },
        (_, index) => ({ empty: true, key: `empty-${index}` })
      ),
      ...Array.from(
        { length: new Date(year, monthIndex + 1, 0).getDate() },
        (_, index) => {
          const date = dayKey(year, monthIndex, index + 1);

          return {
            date,
            day: index + 1,
            booked: booked.has(date),
            status: manual.get(date),
            past: date < today,
          };
        }
      ),
    ];
  }, [calendar, month]);

  const update = async (date, status) => {
    const today = dayKey(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    );

    if (date < today) return;

    setError("");

    try {
      if (status === "clear") {
        await readJson(
          await apiFetch(`/photographers/me/availability/${date}`, {
            method: "DELETE",
          })
        );
      } else {
        await readJson(
          await apiFetch(`/photographers/me/availability/${date}`, {
            method: "PUT",
            body: JSON.stringify({ status }),
          })
        );
      }

      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to save availability.");
    }
  };

  return (
    <div className="model-availability-manager">
      <div className="model-availability-heading">
        <div>
          <p>Schedule preferences</p>
          <h2>Manage Availability</h2>
        </div>

        <div className="model-availability-legend">
          <span>
            <i className="model-availability-dot is-available" />
            Available
          </span>
          <span>
            <i className="model-availability-dot is-unavailable" />
            Unavailable
          </span>
          <span>
            <i className="model-availability-dot is-booked" />
            Booked
          </span>
        </div>
      </div>

      {error && (
        <p className="model-availability-error" role="alert">
          {error}
        </p>
      )}

      <div className="model-availability-controls">
        <button
          type="button"
          onClick={() =>
            setMonth(
              (date) =>
                new Date(date.getFullYear(), date.getMonth() - 1, 1)
            )
          }
        >
          ←
        </button>

        <strong>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </strong>

        <button
          type="button"
          onClick={() =>
            setMonth(
              (date) =>
                new Date(date.getFullYear(), date.getMonth() + 1, 1)
            )
          }
        >
          →
        </button>
      </div>

      {loading ? (
        <p role="status">Loading calendar…</p>
      ) : (
        <>
          <div className="model-availability-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day) => (
                <span key={day}>{day}</span>
              )
            )}
          </div>

          <div className="model-availability-grid">
            {dates.map((entry) =>
              entry.empty ? (
                <span key={entry.key} />
              ) : (
                <div
                  className={`model-availability-day${
                    entry.booked ? " is-booked" : ""
                  }${entry.status ? ` is-${entry.status}` : ""}${
                    entry.past ? " is-past" : ""
                  }`}
                  key={entry.date}
                >
                  <span>{entry.day}</span>

                  {!entry.booked && !entry.past && (
                    <div className="model-availability-actions">
                      <button
                        type="button"
                        onClick={() => update(entry.date, "available")}
                      >
                        Available
                      </button>

                      <button
                        type="button"
                        onClick={() => update(entry.date, "unavailable")}
                      >
                        Unavailable
                      </button>

                      {entry.status && (
                        <button
                          type="button"
                          onClick={() => update(entry.date, "clear")}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <p className="model-availability-note">
            Confirmed bookings and event participation take priority.
            Past dates cannot be edited.
          </p>
        </>
      )}
    </div>
  );
}

export default function PhotographerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, restoreSession } = useAuth();

  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [bookings, setBookings] = useState({
    sent: [],
    received: [],
  });
  const [eventBookings, setEventBookings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeSection =
    new URLSearchParams(location.search).get("section") || "overview";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { user: current } = await getCurrentUser();

      if (current.role !== "photographer") {
        throw new Error(
          "This account cannot access the photographer workspace."
        );
      }

      setUser(current);
      setForm(current);

      if (current.approvalStatus === "approved") {
        const results = await Promise.allSettled([
          apiFetch("/notifications").then(readJson),
          apiFetch("/direct-bookings").then(readJson),
          apiFetch("/events/talent/bookings/mine").then(readJson),
        ]);

        if (results[0].status === "fulfilled") {
          setNotifications(results[0].value.notifications || []);
        } else {
          setError(
            results[0].reason.message || "Unable to load notifications."
          );
        }

        if (results[1].status === "fulfilled") {
          setBookings(results[1].value);
        } else {
          setError(
            (previous) =>
              previous ||
              results[1].reason.message ||
              "Unable to load direct bookings."
          );
        }

        if (results[2].status === "fulfilled") {
          setEventBookings(results[2].value.bookings || []);
        } else {
          setError(
            (previous) =>
              previous ||
              results[2].reason.message ||
              "Unable to load event bookings."
          );
        }
      } else {
        setNotifications([]);
        setBookings({ sent: [], received: [] });
        setEventBookings([]);
      }
    } catch (requestError) {
      setError(
        requestError.message || "Unable to load photographer account."
      );
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
    if (
      !loading &&
      user &&
      !["overview", "bookings", "messages"].includes(activeSection)
    ) {
      document
        .getElementById(activeSection)
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [activeSection, loading, user]);

  const goTo = (section) => {
    setSidebarOpen(false);

    if (["bookings", "messages"].includes(section)) {
      return navigate("/my-bookings");
    }

    navigate(`/photographer-dashboard?section=${section}`);
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    if (user.approvalStatus !== "approved") return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const changes = Object.fromEntries(
        PROFILE_FIELDS.map(([field]) => [field, form[field]])
      );

      const { user: updated } = await readJson(
        await apiFetch("/auth/me/profile", {
          method: "PATCH",
          body: JSON.stringify(changes),
        })
      );

      setUser(updated);
      setForm(updated);
      setEditing(false);
      setNotice("Your profile changes have been saved.");

      await restoreSession();
    } catch (requestError) {
      setError(requestError.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id) => {
    try {
      await readJson(
        await apiFetch(`/notifications/${id}/read`, {
          method: "PATCH",
          body: "{}",
        })
      );

      setNotifications((items) =>
        items.map((item) =>
          item._id === id ? { ...item, read: true } : item
        )
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to update the notification.");
    }
  };

  const signOut = async () => {
    await logout();
    navigate("/");
  };

  if (loading) {
    return (
      <main className="client-dashboard-loading">
        Loading photographer workspace…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="client-dashboard-loading">
        <div>
          <p className="client-dashboard-error" role="alert">
            {error || "Photographer account is unavailable."}
          </p>
          <button
            className="client-secondary-button"
            onClick={() => navigate("/login")}
          >
            Return to login
          </button>
        </div>
      </main>
    );
  }

  const approved = user.approvalStatus === "approved";
  const pending = user.approvalStatus === "pending";
  const unreadCount = notifications.filter((item) => !item.read).length;
  const receivedBookings = bookings.received || [];
  const sentBookings = bookings.sent || [];

  const confirmedBookings = [
    ...receivedBookings,
    ...sentBookings,
  ].filter((item) => item.status === "confirmed");

  const profileImage = imageUrl(user.profileImage);
  const website = safeWebsite(user.portfolio);

  const fieldValue = (source, field) => source[field] ?? "";

  return (
    <div
      className="client-dashboard-shell model-account-shell photographer-account-shell"
      id="dashboard-top"
    >
      <aside
        className={`client-sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="Photographer account navigation"
      >
        <div className="client-brand">
          <span className="client-brand-mark">P</span>
          <span>
            <span className="brand-model">Model</span>
            <span className="brand-next">Next</span>
          </span>
        </div>

        <p className="client-sidebar-label">PHOTOGRAPHER WORKSPACE</p>

        <nav className="client-nav-list">
          {NAV_ITEMS.map(([label, icon, section]) => {
            const restricted =
              ["availability", "my-events", "bookings", "messages"].includes(
                section
              ) && !approved;

            return (
              <button
                key={section}
                type="button"
                disabled={restricted}
                aria-current={
                  activeSection === section ? "page" : undefined
                }
                className={`client-nav-item ${
                  activeSection === section ? "is-active" : ""
                }`}
                onClick={() => goTo(section)}
              >
                <span aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}

          {approved && (
            <button
              type="button"
              className="client-nav-item"
              onClick={() => navigate("/event-chats")}
            >
              <span aria-hidden="true">◇</span>
              <span>Event Group Chats</span>
            </button>
          )}
        </nav>

        <div className="client-sidebar-bottom">
          <button
            type="button"
            className="client-nav-item"
            onClick={() => goTo("notifications")}
          >
            <span aria-hidden="true">◔</span>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <strong className="client-unread-count">{unreadCount}</strong>
            )}
          </button>

          <button
            type="button"
            className="client-nav-item"
            onClick={() => navigate("/")}
          >
            <span aria-hidden="true">←</span>
            <span>Back to Website</span>
          </button>

          <button
            type="button"
            className="client-nav-item"
            onClick={signOut}
          >
            <span aria-hidden="true">↗</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="client-sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="client-dashboard-main">
        <header className="client-topbar">
          <button
            type="button"
            className="client-menu-button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="client-search">
            <span aria-hidden="true">⌂</span>
            <strong>My Account</strong>
          </div>

          <div className="client-topbar-actions">
            <button
              type="button"
              className="client-icon-button"
              aria-label="Notifications"
              onClick={() => goTo("notifications")}
            >
              ◔{unreadCount > 0 && <i>{unreadCount}</i>}
            </button>

            {approved && (
              <button
                type="button"
                className="client-icon-button"
                aria-label="Messages"
                onClick={() => goTo("messages")}
              >
                ◌
              </button>
            )}

            <div className="client-user-chip">
              {profileImage ? (
                <img
                  className="client-avatar model-account-avatar"
                  src={profileImage}
                  alt=""
                />
              ) : (
                <span className="client-avatar">
                  {(user.name || "P").charAt(0).toUpperCase()}
                </span>
              )}

              <span>
                <strong>{user.name}</strong>
                <small>Photographer</small>
              </span>
            </div>
          </div>
        </header>

        <section className="client-welcome" id="overview">
          <div>
            <p className="client-eyebrow">PHOTOGRAPHER WORKSPACE</p>
            <h1>Welcome back, {user.name}</h1>
            <p>
              Manage your professional profile, portfolio link, availability
              and bookings.
            </p>
          </div>

          <span
            className={`model-account-status-chip is-${
              user.approvalStatus || "pending"
            }`}
          >
            {approved
              ? "Approved"
              : pending
                ? "Pending approval"
                : "Registration not approved"}
          </span>
        </section>

        {location.state?.registrationSubmitted && (
          <p className="model-account-approval-banner" role="status">
            <strong>Registration submitted successfully.</strong> Your
            account is awaiting administrator approval.
          </p>
        )}

        {pending && (
          <div className="model-account-approval-banner">
            <strong>Pending administrator approval</strong>
            <p>Your submitted profile is view-only until it is approved.</p>
          </div>
        )}

        {user.approvalStatus === "rejected" && (
          <div className="model-account-approval-banner photographer-rejected">
            <strong>Registration not approved</strong>
            <p>
              {user.rejectionReason ||
                "Contact support if you need assistance."}
            </p>
          </div>
        )}

        {error && (
          <p className="client-dashboard-error" role="alert">
            {error}
          </p>
        )}

        {notice && (
          <p className="client-dashboard-notice" role="status">
            {notice}
          </p>
        )}

        <section
          className="client-stat-grid"
          aria-label="Photographer account summary"
        >
          <DashboardStatCard
            icon="◉"
            label="Profile status"
            value={approved ? "Approved" : pending ? "Pending" : "Review"}
            detail={
              approved
                ? "Professional features available"
                : "Profile is view-only"
            }
            onClick={() => goTo("profile")}
          />

          <DashboardStatCard
            icon="▧"
            label="Portfolio"
            value={website ? "Linked" : "Not linked"}
            detail="Public portfolio website"
            onClick={() => goTo("portfolio")}
          />

          <DashboardStatCard
            icon="▤"
            label="Bookings"
            value={
              approved
                ? receivedBookings.length +
                  sentBookings.length +
                  eventBookings.length
                : "—"
            }
            detail={
              approved
                ? `${confirmedBookings.length} confirmed direct bookings`
                : "Available after approval"
            }
            onClick={approved ? () => goTo("bookings") : undefined}
          />

          <DashboardStatCard
            icon="◔"
            label="Notifications"
            value={unreadCount}
            detail="Unread account notifications"
            onClick={() => goTo("notifications")}
          />
        </section>

        <section
          className="client-panel model-account-panel"
          id="profile"
          tabIndex="-1"
        >
          <SectionHeader
            eyebrow="PHOTOGRAPHER ACCOUNT"
            title="My Profile"
            action={approved && !editing ? "Edit Profile" : undefined}
            onAction={() => setEditing(true)}
          />

          {editing && approved ? (
            <form
              className="model-account-profile-form"
              onSubmit={saveProfile}
            >
              {PROFILE_FIELDS.map(([field, label]) => (
                <label key={field}>
                  {label}
                  <input
                    disabled={field === "username"}
                    type={
                      field === "experienceYears"
                        ? "number"
                        : field === "portfolio"
                          ? "url"
                          : "text"
                    }
                    min={field === "experienceYears" ? "0" : undefined}
                    value={fieldValue(form, field)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}

              <div className="model-account-form-actions">
                <button className="client-primary-button" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="client-secondary-button"
                  onClick={() => {
                    setForm(user);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="model-account-profile-grid">
              {PROFILE_FIELDS.filter(
                ([field]) => field !== "portfolio"
              ).map(([field, label]) => (
                <article className="model-account-detail-card" key={field}>
                  <span>{label}</span>
                  <strong>{fieldValue(user, field) || "Not provided"}</strong>
                </article>
              ))}

              <article className="model-account-detail-card">
                <span>Email</span>
                <strong>{user.email || "Not provided"}</strong>
              </article>
            </div>
          )}

          {!approved && (
            <p className="model-account-readonly-note">
              Your submitted registration details are view-only until
              administrator approval.
            </p>
          )}
        </section>

        <section
          className="client-panel model-account-panel"
          id="portfolio"
          tabIndex="-1"
        >
          <SectionHeader eyebrow="YOUR WORK" title="Portfolio" />

          <div className="photographer-portfolio-summary">
            {profileImage ? (
              <img src={profileImage} alt={`${user.name} profile`} />
            ) : (
              <span className="photographer-portfolio-placeholder">
                {(user.name || "P").charAt(0).toUpperCase()}
              </span>
            )}

            <div>
              <h3>Public portfolio</h3>

              {website ? (
                <>
                  <p>
                    Your portfolio website is connected to your public
                    photographer profile.
                  </p>
                  <a
                    className="model-account-text-link"
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open portfolio website ↗
                  </a>
                </>
              ) : (
                <p>
                  No portfolio website has been added yet. Use Edit Profile
                  to add one.
                </p>
              )}
            </div>
          </div>
        </section>

        {approved && (
          <section
            className="client-panel model-account-panel"
            id="availability"
            tabIndex="-1"
          >
            <SectionHeader
              eyebrow="SCHEDULE PREFERENCES"
              title="Availability Calendar"
            />
            <PhotographerAvailabilityManager />
          </section>
        )}

        {approved && (
          <div className="client-panel model-account-panel photographer-events-panel">
            <MyEvents />
          </div>
        )}

        {approved && (
          <section
            className="client-panel model-account-panel"
            id="bookings"
            tabIndex="-1"
          >
            <SectionHeader
              eyebrow="PROFESSIONAL WORK"
              title="My Bookings"
              action="Open Bookings"
              onAction={() => navigate("/my-bookings")}
            />

            <h3>Event Booking Requests</h3>

            {eventBookings.length === 0 ? (
              <p className="model-account-empty">
                No event booking requests yet.
              </p>
            ) : (
              <div className="model-account-booking-list">
                {eventBookings.map((booking) => (
                  <article key={booking.id}>
                    <div>
                      <strong>{booking.eventTitle}</strong>
                      <span>
                        {booking.eventType || "Event"} ·{" "}
                        {booking.location || "Location not specified"}
                      </span>
                      <span>
                        Status:{" "}
                        {booking.status
                          ? booking.status.charAt(0).toUpperCase() +
                            booking.status.slice(1)
                          : "Pending"}
                      </span>
                      {booking.createdAt && (
                        <small>
                          Received{" "}
                          {new Date(booking.createdAt).toLocaleDateString()}
                        </small>
                      )}
                    </div>

                    <Link
                      to={`/my-bookings?eventBooking=${booking.id}`}
                    >
                      View Request
                    </Link>
                  </article>
                ))}
              </div>
            )}

            <h3>Direct Bookings</h3>

            {!receivedBookings.length && !sentBookings.length ? (
              <p className="model-account-empty">
                No direct bookings yet.
              </p>
            ) : (
              <div className="model-account-booking-list">
                {[...receivedBookings, ...sentBookings]
                  .slice(0, 5)
                  .map((booking) => (
                    <article key={booking.id}>
                      <div>
                        <strong>
                          {booking.jobType || "Direct booking"}
                        </strong>
                        <span>
                          {booking.status} · {booking.bookingDate} ·{" "}
                          {booking.location}
                        </span>
                      </div>

                      <Link to={`/my-bookings/${booking.id}`}>
                        View Details
                      </Link>
                    </article>
                  ))}
              </div>
            )}

            <Link className="model-account-text-link" to="/my-bookings">
              View and manage all bookings
            </Link>
          </section>
        )}

        {approved && (
          <section
            className="client-panel model-account-panel"
            id="messages"
            tabIndex="-1"
          >
            <SectionHeader
              eyebrow="PRIVATE CONVERSATIONS"
              title="Private Messages"
            />
            <p className="model-account-empty">
              Private conversations are available for confirmed and completed
              bookings.
            </p>
            <Link className="model-account-text-link" to="/my-bookings">
              Open My Bookings to continue a conversation
            </Link>
          </section>
        )}

        <section
          className="client-panel model-account-panel"
          id="notifications"
          tabIndex="-1"
        >
          <SectionHeader eyebrow="ACCOUNT UPDATES" title="Notifications" />

          {pending && (
            <article className="model-account-notification">
              <strong>Pending administrator approval</strong>
              <p>Your account is currently being reviewed.</p>
            </article>
          )}

          {notifications.length
            ? notifications.map((item) => (
                <article
                  className="model-account-notification"
                  key={item._id}
                >
                  <div>
                    <strong>{item.message}</strong>
                    {item.createdAt && (
                      <time>
                        {new Date(item.createdAt).toLocaleString()}
                      </time>
                    )}
                  </div>

                  <button
                    type="button"
                    className="client-text-button"
                    disabled={item.read}
                    onClick={() => markRead(item._id)}
                  >
                    {item.read ? "Read" : "Mark read"}
                  </button>
                </article>
              ))
            : !pending && (
                <p className="model-account-empty">No notifications.</p>
              )}
        </section>

        <section
          className="client-panel model-account-panel"
          id="settings"
          tabIndex="-1"
        >
          <SectionHeader eyebrow="ACCOUNT" title="Account Settings" />

          <div className="model-account-settings-row">
            <span>Email address</span>
            <strong>{user.email}</strong>
          </div>

          <div className="model-account-settings-row">
            <span>Approval status</span>
            <strong>
              {approved
                ? "Approved"
                : pending
                  ? "Pending administrator approval"
                  : user.approvalStatus}
            </strong>
          </div>

          {approved && (
            <button
              type="button"
              className="client-secondary-button"
              onClick={() => {
                setEditing(true);
                goTo("profile");
              }}
            >
              Edit profile details
            </button>
          )}
        </section>

        <section className="client-panel model-account-panel photographer-discovery">
          <SectionHeader
            eyebrow="MODELNEXT DIRECTORY"
            title="Discover Professionals"
          />
          <BrowseTalentLinks />
        </section>

        <footer className="model-account-footer">
          <button type="button" onClick={() => navigate("/")}>
            ← Back to Website
          </button>

          {approved && (
            <Link to={`/photographers/${user.id || user._id}`}>
              View public profile
            </Link>
          )}

          <button type="button" onClick={signOut}>
            Logout
          </button>
        </footer>
      </main>
    </div>
  );
}
