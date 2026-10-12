
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import "../styles/ClientDashboard.css";
import "../styles/ModelAvailability.css";
import "../styles/ModelMyAccount.css";

const MODEL_PENDING_MESSAGE =
  "Your registration is pending administrator approval. You can view your submitted profile information. Editing will be available after approval.";

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
  ["Messages", "◌", "messages"],
  ["Notifications", "◔", "notifications"],
  ["Account Settings", "⚙", "settings"],
];

const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const dayKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const imageUrl = (path) => {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) return path;

  return `${SERVER_BASE_URL}/${String(path)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")}`;
};

function ModelAvailabilityManager() {
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
      const data = await readJson(
        await apiFetch(
          `/models/me/availability?month=${monthKey(month)}`
        )
      );

      setCalendar(data);
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
        (_, index) => ({
          empty: true,
          key: `empty-${index}`,
        })
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
          await apiFetch(`/models/me/availability/${date}`, {
            method: "DELETE",
          })
        );
      } else {
        await readJson(
          await apiFetch(`/models/me/availability/${date}`, {
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
    <section
      className="model-availability-manager"
      aria-labelledby="manage-availability-title"
    >
      <div className="model-availability-heading">
        <div>
          <p>Schedule preferences</p>
          <h2 id="manage-availability-title">Manage Availability</h2>
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
          aria-label="Previous month"
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
          aria-label="Next month"
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
        <p>Loading calendar…</p>
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
            Confirmed bookings are locked and always take priority over
            your preferences. Past dates cannot be edited.
          </p>
        </>
      )}
    </section>
  );
}

export default function ModelMyAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, restoreSession } = useAuth();

  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [notifications, setNotifications] = useState([]);

  // Existing direct bookings: preserved
  const [bookings, setBookings] = useState({
    sent: [],
    received: [],
  });

  // New event booking requests
  const [eventBookingRequests, setEventBookingRequests] = useState([]);
  const [respondingTo, setRespondingTo] = useState("");

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

      if (current.role !== "model") {
        throw new Error(
          "This account cannot access the Model My Account page."
        );
      }

      setUser(current);
      setForm(current);

      if (current.approvalStatus === "approved") {
        const results = await Promise.allSettled([
          apiFetch("/notifications").then(readJson),
          apiFetch("/direct-bookings").then(readJson),
          apiFetch("/events/requests/mine").then(readJson),
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
          const requests = results[2].value.requests || [];

          setEventBookingRequests(
            requests.filter(
              (request) =>
                request.requestType === "booking" &&
                ["pending", "confirmed", "declined"].includes(
                  request.status
                )
            )
          );
        } else {
          setError(
            (previous) =>
              previous ||
              results[2].reason.message ||
              "Unable to load event booking requests."
          );
        }
      } else {
        setNotifications([]);
        setBookings({ sent: [], received: [] });
        setEventBookingRequests([]);
        setEditing(false);
      }
    } catch (requestError) {
      setError(
        requestError.message || "Unable to load your Model account."
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
    const target = document.getElementById(activeSection);

    target?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });

    setSidebarOpen(false);
  }, [activeSection, loading]);

  const goTo = (section) =>
    navigate({ search: `?section=${section}` });

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
      changes.categories = changes.categories
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    try {
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
    } catch (requestError) {
      setError(
        requestError.message || "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  // Accept or decline an event booking request
  const respondToEventBooking = async (requestId, status) => {
    const action = status === "confirmed" ? "accept" : "decline";

    if (
      !window.confirm(
        `Are you sure you want to ${action} this booking request?`
      )
    ) {
      return;
    }

    setRespondingTo(String(requestId));
    setError("");
    setNotice("");

    try {
      await readJson(
        await apiFetch(
          `/events/bookings/${requestId}/respond`,
          {
            method: "PATCH",
            body: JSON.stringify({ status }),
          }
        )
      );

      setEventBookingRequests((current) =>
        current.map((request) =>
          String(request.id) === String(requestId)
            ? { ...request, status }
            : request
        )
      );

      setNotice(
        status === "confirmed"
          ? "Booking request accepted successfully."
          : "Booking request declined."
      );

      // Refresh notifications without replacing the booking list
      try {
        const notificationData = await readJson(
          await apiFetch("/notifications")
        );

        setNotifications(notificationData.notifications || []);
      } catch {
        // The booking response succeeded; notification refresh is optional.
      }
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to respond to the booking request."
      );
    } finally {
      setRespondingTo("");
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
      setError(
        requestError.message || "Unable to update the notification."
      );
    }
  };

  if (loading && !user) {
    return (
      <main className="client-dashboard-loading">
        Loading your Model account…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="client-dashboard-loading" role="alert">
        {error || "Your session has expired. Please sign in again."}
      </main>
    );
  }

  const approved = user.approvalStatus === "approved";
  const pending = user.approvalStatus === "pending";
  const unreadCount = notifications.filter((item) => !item.read).length;

  const receivedBookings = bookings.received || [];
  const confirmedBookings = receivedBookings.filter(
    (item) => item.status === "confirmed"
  );

  const portfolio = Array.isArray(user.portfolioImages)
    ? user.portfolioImages
    : [];

  const profileImage = imageUrl(user.profileImage);

  const fieldValue = (source, field) =>
    Array.isArray(source[field])
      ? source[field].join(", ")
      : source[field] || "";

  return (
    <div
      className="client-dashboard-shell model-account-shell"
      id="dashboard-top"
    >
      <aside
        className={`client-sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="Model account navigation"
      >
        <div className="client-brand">
          <span className="client-brand-mark">M</span>
          <span>
            <span className="brand-model">Model</span>
            <span className="brand-next">Next</span>
          </span>
        </div>

        <p className="client-sidebar-label">MODEL WORKSPACE</p>

        <nav className="client-nav-list">
          {NAV_ITEMS.map(([label, icon, section]) => {
            const restricted =
              ["availability", "bookings", "messages"].includes(section) &&
              !approved;

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
              <strong className="client-unread-count">
                {unreadCount}
              </strong>
            )}
          </button>

          <button
            type="button"
            className="client-nav-item"
            onClick={backToWebsite}
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
                  {(user.fullName || "M").charAt(0).toUpperCase()}
                </span>
              )}

              <span>
                <strong>{user.fullName || user.name}</strong>
                <small>Model</small>
              </span>
            </div>
          </div>
        </header>

        <section className="client-welcome" id="overview">
          <div>
            <p className="client-eyebrow">MODEL WORKSPACE</p>
            <h1>Welcome back, {user.fullName || user.name}</h1>
            <p>
              Manage your profile, portfolio, schedule and professional
              bookings.
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

        {pending && (
          <section className="model-account-approval-banner" role="status">
            <strong>Pending Admin Approval</strong>
            <p>{MODEL_PENDING_MESSAGE}</p>
          </section>
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
          aria-label="Model account summary"
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
            label="Portfolio photos"
            value={portfolio.length}
            detail="Photos in your submitted portfolio"
            onClick={() => goTo("portfolio")}
          />

          <DashboardStatCard
            icon="▤"
            label="Received bookings"
            value={
              approved
                ? receivedBookings.length + eventBookingRequests.length
                : "—"
            }
            detail={
              approved
                ? `${
                    confirmedBookings.length +
                    eventBookingRequests.filter(
                      (request) => request.status === "confirmed"
                    ).length
                  } confirmed`
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
            eyebrow="MODEL ACCOUNT"
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
                <button
                  type="submit"
                  className="client-primary-button"
                  disabled={saving}
                >
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
              {PROFILE_FIELDS.map(([field, label]) => (
                <article
                  className="model-account-detail-card"
                  key={field}
                >
                  <span>{label}</span>
                  <strong>
                    {fieldValue(user, field) || "Not provided"}
                  </strong>
                </article>
              ))}

              <article className="model-account-detail-card">
                <span>Email</span>
                <strong>{user.email || "Not provided"}</strong>
              </article>

              <article className="model-account-detail-card">
                <span>Skills</span>
                <strong>
                  {fieldValue(user, "skills") || "Not provided"}
                </strong>
              </article>

              <article className="model-account-detail-card">
                <span>Document type</span>
                <strong>{user.idType || "Not provided"}</strong>
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

          {portfolio.length ? (
            <div className="model-account-portfolio-grid">
              {portfolio.map((image, index) => {
                const src = imageUrl(
                  typeof image === "string"
                    ? image
                    : image?.url || image?.path
                );

                return src ? (
                  <article
                    className="client-talent-card"
                    key={`${src}-${index}`}
                  >
                    <div className="client-talent-image">
                      <img
                        src={src}
                        alt={`Portfolio image ${index + 1}`}
                        loading="lazy"
                      />
                    </div>
                  </article>
                ) : null;
              })}
            </div>
          ) : (
            <p className="model-account-empty">
              No portfolio photos have been added to your account.
            </p>
          )}

          {!approved && (
            <p className="model-account-readonly-note">
              Portfolio photos cannot be changed until administrator
              approval.
            </p>
          )}
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
            <ModelAvailabilityManager />
          </section>
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

            <h3>Direct Bookings</h3>

            {!receivedBookings.length ? (
              <p className="model-account-empty">
                No direct bookings have been received yet.
              </p>
            ) : (
              <div className="model-account-booking-list">
                {receivedBookings.slice(0, 5).map((booking) => (
                  <article key={booking.id}>
                    <div>
                      <strong>{booking.jobType}</strong>
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

            <div className="model-account-event-bookings">
              <h3>Event Booking Requests</h3>

              {!eventBookingRequests.length ? (
                <p className="model-account-empty">
                  No event booking requests have been received yet.
                </p>
              ) : (
                <div className="model-account-booking-list">
                  {eventBookingRequests.map((request) => {
                    const isResponding =
                      respondingTo === String(request.id);

                    return (
                      <article key={request.id}>
                        <div>
                          <strong>{request.eventTitle}</strong>

                          {request.eventType && (
                            <span>{request.eventType}</span>
                          )}

                          {request.eventLocation && (
                            <span>{request.eventLocation}</span>
                          )}

                          <span>
                            Status:{" "}
                            {request.status.charAt(0).toUpperCase() +
                              request.status.slice(1)}
                          </span>
                        </div>

                        {request.status === "pending" && (
                          <div className="model-account-booking-actions">
                            <button
                              type="button"
                              disabled={Boolean(respondingTo)}
                              onClick={() =>
                                respondToEventBooking(
                                  request.id,
                                  "confirmed"
                                )
                              }
                            >
                              {isResponding ? "Processing…" : "Accept"}
                            </button>

                            <button
                              type="button"
                              disabled={Boolean(respondingTo)}
                              onClick={() =>
                                respondToEventBooking(
                                  request.id,
                                  "declined"
                                )
                              }
                            >
                              {isResponding ? "Processing…" : "Decline"}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <Link
              className="model-account-text-link"
              to="/my-bookings"
            >
              View direct bookings
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
              title="Messages"
            />
            <p className="model-account-empty">
              Private conversations are available for confirmed bookings.
            </p>
            <Link
              className="model-account-text-link"
              to="/my-bookings"
            >
              Open My Bookings to continue a booking conversation
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
              <p>{MODEL_PENDING_MESSAGE}</p>
            </article>
          )}

          {notifications.length ? (
            notifications.map((item) => (
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
          ) : (
            !pending && (
              <p className="model-account-empty">No notifications.</p>
            )
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

        <footer className="model-account-footer">
          <Link to="/">Back to Website</Link>
          <button type="button" onClick={signOut}>
            Logout
          </button>
        </footer>
      </main>
    </div>
  );
}
