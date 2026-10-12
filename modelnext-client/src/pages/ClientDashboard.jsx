import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, getCurrentUser, readJson } from "../api";
import { useAuth } from "../context/AuthContext";
import ClientSidebar from "../components/client-dashboard/ClientSidebar";
import DashboardStatCard from "../components/client-dashboard/DashboardStatCard";
import SectionHeader from "../components/client-dashboard/SectionHeader";
import MyEvents from '../components/MyEvents';
import BrowseTalentLinks from '../components/BrowseTalentLinks';
import "../styles/ClientDashboard.css";

const initialProject = {
  title: "",
  eventType: "Event",
  startDate: "",
  endDate: "",
  location: "",
  description: "",
  requiredGender: "",
  minAge: "",
  maxAge: "",
  minHeight: "",
  maxHeight: "",
  requiredCategories: [],
  requiredSkills: [],
};

const bookingFilters = [
  "All",
  "Pending",
  "Confirmed",
  "Declined",
];

const listValue = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const imageUrl = (path) =>
  path
    ? path.startsWith("http")
      ? path
      : `http://localhost:5000/${path.replace(/\\/g, "/")}`
    : "";

const formatDate = (value) => {
  if (!value) return "Date to be confirmed";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date to be confirmed";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
};

const projectState = (event, now = new Date()) => {
  if (event.status === "rejected") {
    return "Cancelled";
  }

  const start = new Date(event.startDate);
  const end = new Date(event.endDate || event.startDate);

  if (Number.isNaN(start.getTime())) {
    return "All";
  }

  if (end < now) {
    return "Completed";
  }

  if (start > now) {
    return "Upcoming";
  }

  return "Ongoing";
};

const normalizeBookingStatus = (status) => {
  const value = String(status || "").toLowerCase();

  if (value === "confirmed") return "Confirmed";
  if (value === "declined") return "Declined";
  return "Pending";
};

const dashboardSectionIds = {
  dashboard: "dashboard-top",
  profile: "profile",
  bookings: "bookings",
  messages: "messages",
  notifications: "notifications",
  'my-events': 'my-events',
  recommendations: 'recommendations',
};

const CATEGORY_OPTIONS = [
  'Commercial',
  'Fashion',
  'Lifestyle',
  'Menswear',
  'Womenswear',
  'Fitness',
  'Campaign',
  'Runway',
  'Beauty',
  'Editorial',
  'Sportswear',
  'Bridal',
  'Product Modeling',
  'Promotional',
];

const SKILL_OPTIONS = [
  'Posing',
  'Runway Walking',
  'Fashion Modeling',
  'Commercial Modeling',
  'Photo Shoots',
  'Acting',
  'Dancing',
  'Fitness Modeling',
  'Product Modeling',
  'Camera Confidence',
  'Facial Expressions',
  'Promotional Modeling',
];

function MultiSelect({ label, options, value = [], onChange, disabled }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="client-multiselect">
      <label>{label}</label>

      <button
        type="button"
        className="client-multiselect-trigger"
        disabled={disabled}
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
      >
        <span>
          {value.length
            ? `${value.length} selected`
            : `Select ${label.toLowerCase()}`}
        </span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="client-multiselect-options">
          {options.map((option) => (
            <label key={option} className="client-multiselect-option">
              <input
                type="checkbox"
                checked={value.includes(option)}
                disabled={disabled}
                onChange={() => {
                  onChange(
                    value.includes(option)
                      ? value.filter((item) => item !== option)
                      : [...value, option]
                  );
                }}
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="client-multiselect-selected">
          {value.map((item) => (
            <span key={item} className="client-multiselect-chip">
              {item}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${item}`}
                onClick={() =>
                  onChange(value.filter((selected) => selected !== item))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [user, setUser] = useState(null);
  const projectInFlight = useRef(false);
  const [events, setEvents] = useState([]);
  const [publicEvents, setPublicEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);

  /* AI recommendations */
  const [selectedAIEventId, setSelectedAIEventId] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationEvent, setRecommendationEvent] = useState(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");

  /* Dashboard */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /* Navigation */
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(
    () => new URLSearchParams(location.search).get("section") || "dashboard"
  );

  /* Search and filters */
  const [query, setQuery] = useState("");
  const [bookingFilter, setBookingFilter] = useState("All");

  /* Project modal */
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [projectForm, setProjectForm] = useState(initialProject);
  const [savingProject, setSavingProject] = useState(false);

  /*
   * Load AI recommendations for ONE selected event.
   * There is intentionally no automatic first-event selection here.
   */
  const loadRecommendations = useCallback(async (eventId) => {
    if (!eventId) {
      setRecommendations([]);
      setRecommendationEvent(null);
      setRecommendationError("");
      return;
    }

    setRecommendationLoading(true);
    setRecommendationError("");
    setRecommendations([]);
    setRecommendationEvent(null);

    try {
      const data = await readJson(
        await apiFetch(`/matching/events/${eventId}/models`)
      );

      setRecommendations(data.matches || []);
      setRecommendationEvent(data.event || null);
    } catch (err) {
      setRecommendations([]);
      setRecommendationEvent(null);
      setRecommendationError(
        err.message || "Recommendations are unavailable right now."
      );
    } finally {
      setRecommendationLoading(false);
    }
  }, []);

  /*
   * Reload dashboard data.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { user: current } = await getCurrentUser();

      if (current.role !== "client") {
        throw new Error("This account cannot access the client portal.");
      }

      const [
        mine,
        notificationData,
        listed,
        bookingData,
      ] = await Promise.all([
        readJson(await apiFetch("/events/mine")),
        readJson(await apiFetch("/notifications")),
        readJson(await apiFetch("/events")),
        readJson(await apiFetch("/events/bookings/mine")),
      ]);

      const ownedEvents = mine.events || [];

      setUser(current);
      setEvents(ownedEvents);

      /*
       * These are still the pending requests used by the
       * Participation Requests section.
       */
      setRequests(mine.requests || []);

      /*
       * This contains pending + confirmed + declined.
       */
      setBookings(bookingData.bookings || []);

      setNotifications(notificationData.notifications || []);
      setPublicEvents(listed.events || []);

      /*
       * Do NOT automatically select the first event.
       *
       * If the currently selected event was deleted/rejected,
       * clear the selection.
       */
      setSelectedAIEventId((currentSelected) => {
        if (
          currentSelected &&
          ownedEvents.some(
            (event) =>
              event.id === currentSelected &&
              event.status !== "rejected"
          )
        ) {
          return currentSelected;
        }

        return "";
      });
    } catch (err) {
      if (
        /authentication is required|authentication is invalid|authentication has expired/i.test(
          err.message || ""
        )
      ) {
        navigate("/login", { replace: true });
        return;
      }

      setError(err.message || "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const requestedSection =
      new URLSearchParams(location.search).get("section") || "dashboard";
    const section = dashboardSectionIds[requestedSection]
      ? requestedSection
      : "dashboard";

    setActiveNav(section);

    const frame = requestAnimationFrame(() => {
      document
        .getElementById(dashboardSectionIds[section])
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.search, loading]);

  /*
   * Load AI matches whenever the user changes the selected event.
   */
  useEffect(() => {
    if (!selectedAIEventId) {
      setRecommendations([]);
      setRecommendationEvent(null);
      setRecommendationError("");
      return;
    }

    loadRecommendations(selectedAIEventId);
  }, [selectedAIEventId, loadRecommendations]);

  /*
   * Create / edit project.
   */
  const saveProject = async (event) => {
    event.preventDefault();
    if (projectInFlight.current) return;
    projectInFlight.current = true;

    setSavingProject(true);
    setError("");

    try {
      const payload = {
        ...projectForm,
        startDate: new Date(projectForm.startDate).toISOString(),
        endDate: projectForm.endDate ? new Date(projectForm.endDate).toISOString() : '',

        requiredGender:
          projectForm.requiredGender || undefined,

        minAge:
          projectForm.minAge === ""
            ? undefined
            : Number(projectForm.minAge),

        maxAge:
          projectForm.maxAge === ""
            ? undefined
            : Number(projectForm.maxAge),

        minHeight:
          projectForm.minHeight === ""
            ? undefined
            : Number(projectForm.minHeight),

        maxHeight:
          projectForm.maxHeight === ""
            ? undefined
            : Number(projectForm.maxHeight),

        equiredCategories: projectForm.requiredCategories,

   requiredSkills: projectForm.requiredSkills,
      };

      const endpoint = editingEvent
        ? `/events/${editingEvent.id}`
        : "/events";

      const method = editingEvent ? "PATCH" : "POST";

      const { event: savedEvent } = await readJson(
        await apiFetch(endpoint, {
          method,
          body: JSON.stringify(payload),
        })
      );

      setProjectForm(initialProject);
      setEditingEvent(null);
      setProjectModalOpen(false);

      setNotice(
        editingEvent
          ? "Project updated successfully."
          : "Project created successfully."
      );

      await load();
      if (!editingEvent) navigate(`/account/events/${savedEvent.id}`);
    } catch (err) {
      setError(
        err.message ||
          `Could not ${
            editingEvent ? "update" : "create"
          } this project.`
      );
    } finally {
      projectInFlight.current = false;
      setSavingProject(false);
    }
  };

  const openCreateProject = () => {
    setEditingEvent(null);
    setProjectForm(initialProject);
    setProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    setProjectModalOpen(false);
    setEditingEvent(null);
    setProjectForm(initialProject);
  };

  /*
   * Approve / decline participation request.
   */
  const reviewRequest = async (id, status) => {
    try {
      await readJson(
        await apiFetch(`/events/requests/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        })
      );

      setNotice(
        status === "confirmed"
          ? "Talent request confirmed."
          : "Talent request declined."
      );

      await load();
    } catch (err) {
      setError(err.message || "Could not update this request.");
    }
  };

  /*
   * Notifications.
   */
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
          item._id === id
            ? { ...item, read: true }
            : item
        )
      );
    } catch (err) {
      setError(err.message || "Could not update notification.");
    }
  };

  /*
   * Sidebar navigation.
   */
  const goTo = (target) => {
    if (target === "direct-bookings" || target === "private-messages") {
      navigate("/my-bookings");
      return;
    }
    setSidebarOpen(false);

    if (target === "discover") {
      navigate("/models");
      return;
    }

    if (target === "events") {
      navigate("/events");
      return;
    }

    if (target === "event-chats") {
      navigate("/event-chats");
      return;
    }

    if (
      target === "recommendations" &&
      selectedAIEventId
    ) {
      navigate(
        `/client-portal/ai-matches/${selectedAIEventId}`
      );
      return;
    }

    if (!dashboardSectionIds[target]) {
      return;
    }

    navigate({
      pathname: "/client-portal",
      search: target === "dashboard" ? "" : `?section=${target}`,
    });
  };

  const backToWebsite = () => {
    setSidebarOpen(false);
    navigate("/");
  };

  const signOut = async () => {
    setSidebarOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  /*
   * Dashboard calculations.
   */
  const now = new Date();

  const activeProjects = events.filter(
    (event) =>
      event.status !== "rejected" &&
      projectState(event, now) !== "Completed"
  ).length;

  /*
   * BOOKING FILTER
   *
   * All = pending + confirmed + declined
   */
  const filteredBookings = useMemo(() => {
  return bookings
    // All Bookings contains ONLY actual booking requests.
    // Participation requests are handled separately below.
    .filter(
      (booking) =>
        booking.requestType === "booking"
    )
    .filter((booking) => {
      const status = normalizeBookingStatus(
        booking.status
      );

      const matchesStatus =
        bookingFilter === "All" ||
        status === bookingFilter;

      const searchableText = [
        booking.eventTitle,
        booking.requesterRole,
        booking.requesterName,
        booking.eventType,
        booking.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        searchableText.includes(
          query.toLowerCase()
        );

      return (
        matchesStatus &&
        matchesSearch
      );
    });
}, [
  bookings,
  bookingFilter,
  query,
]);

  const visibleRecommendations = recommendations
    .filter((model) =>
      `${model.fullName || ""} ${
        model.location || ""
      } ${(model.categories || []).join(" ")} ${
        (model.skills || []).join(" ")
      }`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
    .slice(0, 3);

  const unreadCount = notifications.filter(
    (item) => !item.read
  ).length;

  const activity = useMemo(
    () =>
      [
        ...notifications.map((item) => ({
          id: `note-${item._id}`,
          date: item.createdAt,
          text: item.message,
          unread: !item.read,
          notificationId: item._id,
        })),

        ...events.map((event) => ({
          id: `event-${event.id}`,
          date: event.createdAt,
          text: `Project created: ${event.title}`,
          unread: false,
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.date) - new Date(a.date)
        )
        .slice(0, 5),
    [notifications, events]
  );

  /*
   * Booking counts.
   */
  const bookingOnly = bookings.filter(
  (booking) =>
    booking.requestType === "booking"
);

const bookingCounts = {
  all: bookingOnly.length,

  pending: bookingOnly.filter(
    (booking) =>
      normalizeBookingStatus(
        booking.status
      ) === "Pending"
  ).length,

  confirmed: bookingOnly.filter(
    (booking) =>
      normalizeBookingStatus(
        booking.status
      ) === "Confirmed"
  ).length,

  declined: bookingOnly.filter(
    (booking) =>
      normalizeBookingStatus(
        booking.status
      ) === "Declined"
  ).length,
};

  if (loading) {
    return (
      <main className="client-dashboard-loading">
        Loading your client workspace…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="client-dashboard-loading">
        {error ||
          "Your session has expired. Please sign in again."}
      </main>
    );
  }

  return (
    <div
      className="client-dashboard-shell"
      id="dashboard-top"
    >
      <ClientSidebar
        isOpen={isSidebarOpen}
        active={activeNav}
        onNavigate={goTo}
        onBackToWebsite={backToWebsite}
        onLogout={signOut}
        unreadCount={unreadCount}
      />

      {isSidebarOpen && (
        <button
          className="client-sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="client-dashboard-main">
        {/* TOP BAR */}
        <header className="client-topbar">
          <button
            type="button"
            className="client-menu-button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <label className="client-search">
            <span aria-hidden="true">⌕</span>

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search for models, photographers, events or projects..."
            />
          </label>

          <div className="client-topbar-actions">
            <button
              type="button"
              className="client-icon-button"
              aria-label="Notifications"
              onClick={() => goTo("notifications")}
            >
              ◔
              {unreadCount > 0 && (
                <i>{unreadCount}</i>
              )}
            </button>

            <button
              type="button"
              className="client-icon-button"
              aria-label="Messages"
              onClick={() => goTo("messages")}
            >
              ◌
            </button>

            <div className="client-user-chip">
              <span className="client-avatar">
                {(user.name || "C")
                  .charAt(0)
                  .toUpperCase()}
              </span>

              <span>
                <strong>{user.name}</strong>
                <small>Client</small>
              </span>
            </div>
          </div>
        </header>

        {/* WELCOME */}
        <section className="client-welcome">
          <div>
            <p className="client-eyebrow">
              CLIENT WORKSPACE
            </p>

            <h1>Welcome back, {user.name}</h1>

            <p>
              Find the right talent, manage your
              projects and bring your vision to life.
            </p>
          </div>

          <button
            type="button"
            className="client-primary-button"
            onClick={openCreateProject}
          >
            ＋ Create New Project
          </button>
        </section>

        <section
          className="client-panel client-profile-summary"
          id="profile"
          tabIndex="-1"
        >
          <SectionHeader
            eyebrow="CLIENT ACCOUNT"
            title="My Profile"
          />
          <div className="client-profile-summary-content">
            <span className="client-profile-summary-avatar" aria-hidden="true">
              {(user.name || "C").charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{user.name || "Client"}</strong>
              {user.email && <span>{user.email}</span>}
              <small>Client account</small>
            </div>
          </div>
        </section>

        {error && (
          <p
            className="client-dashboard-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            className="client-dashboard-notice"
            role="status"
          >
            {notice}
          </p>
        )}

        {/* STAT CARDS */}
        <section
          className="client-stat-grid"
          aria-label="Project summary"
        >
          <DashboardStatCard
            icon="▣"
            label="Active Events"
            value={activeProjects}
            detail="Your current active events"
            onClick={() => goTo("my-events")}
          />

          <DashboardStatCard
            icon="✓"
            label="Total Bookings"
            value={bookingCounts.all}
            detail={`${bookingCounts.confirmed} confirmed · ${bookingCounts.pending} pending`}
            onClick={() => goTo("bookings")}
          />

          <DashboardStatCard
            icon="✦"
            label="AI Recommendations"
            value={
              selectedAIEventId
                ? recommendations.length
                : "—"
            }
            detail={
              recommendationEvent
                ? `For ${recommendationEvent.title}`
                : "Select an event to receive matches"
            }
            onClick={() =>
              goTo("recommendations")
            }
          />
        </section>

        <div className="client-dashboard-columns">
          {/* AI RECOMMENDATIONS */}
          <section
            className="client-panel client-recommendations"
            id="recommendations"
          >
            <SectionHeader
              eyebrow="AI MATCHING"
              title="Recommended Talent"
              action="View All"
              onAction={() => {
                if (selectedAIEventId) {
                  navigate(
                    `/client-portal/ai-matches/${selectedAIEventId}`
                  );
                }
              }}
            />

            {/* EVENT SELECTOR */}
            <div className="client-ai-event-selector">
              <label htmlFor="ai-event-select">
                Select Event
              </label>

              <select
                id="ai-event-select"
                value={selectedAIEventId}
                onChange={(event) =>
                  setSelectedAIEventId(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Select an event
                </option>

                {events
                  .filter(
                    (event) =>
                      event.status !== "rejected"
                  )
                  .map((event) => (
                    <option
                      key={event.id}
                      value={event.id}
                    >
                      {event.title}
                    </option>
                  ))}
              </select>
            </div>

            {!selectedAIEventId ? (
              <p className="client-empty">
                Select an event to see AI-matched
                talent based on that event's
                requirements.
              </p>
            ) : recommendationLoading ? (
              <p className="client-empty">
                Finding the best talent for this
                event…
              </p>
            ) : recommendationError ? (
              <p className="client-empty">
                {recommendationError}
              </p>
            ) : (
              <>
                <div className="client-ai-results-header">
                  <div>
                    <p className="client-eyebrow">
                      MATCHING RESULTS
                    </p>

                    <h3>
                      {recommendationEvent?.title}
                    </h3>

                    <p>
                      AI recommendations based only
                      on this event's requirements.
                    </p>
                  </div>

                  <span className="client-ai-count">
                    {recommendations.length}{" "}
                    {recommendations.length === 1
                      ? "Match"
                      : "Matches"}
                  </span>
                </div>

                {visibleRecommendations.length ===
                0 ? (
                  <p className="client-empty">
                    No recommendations are available
                    for this event yet.
                  </p>
                ) : (
                  <div className="client-talent-grid">
                    {visibleRecommendations.map(
                      (model) => (
                        <article
                          className="client-talent-card"
                          key={model.id}
                        >
                          <div className="client-talent-image">
                            {imageUrl(
                              model.profileImage
                            ) ? (
                              <img
                                src={imageUrl(
                                  model.profileImage
                                )}
                                alt={model.fullName}
                              />
                            ) : (
                              <span>
                                {model.fullName?.charAt(
                                  0
                                ) || "M"}
                              </span>
                            )}

                            <strong>
                              {model.matchScore}%
                              match
                            </strong>
                          </div>

                          <div>
                            <h3>
                              {model.fullName}
                            </h3>

                            <p>
                              {(
                                model.categories || [
                                  "Model",
                                ]
                              ).join(" · ")}
                            </p>

                            <small>
                              {model.location ||
                                "Location not listed"}
                            </small>

                            <div className="client-tags">
                              {(
                                model.skills || []
                              )
                                .slice(0, 2)
                                .map((skill) => (
                                  <span key={skill}>
                                    {skill}
                                  </span>
                                ))}
                            </div>

                            <button
                              type="button"
                              className="client-text-button"
                              onClick={() =>
                                navigate(
                                  `/models/${model.id}?${new URLSearchParams(
                                    {
                                      name:
                                        model.fullName ||
                                        "Model",
                                      role: (
                                        model.categories || [
                                          "Fashion model",
                                        ]
                                      ).join(", "),
                                      img: imageUrl(
                                        model.profileImage
                                      ),
                                      location:
                                        model.location ||
                                        "",
                                      ...(selectedAIEventId ? {
                                        eventId: selectedAIEventId,
                                        eventTitle: recommendationEvent?.title || "Selected Event",
                                        eventType: recommendationEvent?.eventType || "Event",
                                        eventLocation: recommendationEvent?.location || "",
                                      } : {}),
                                    }
                                  )}`
                                )
                              }
                            >
                              View Profile{" "}
                              <span>→</span>
                            </button>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* RIGHT RAIL */}
          <aside className="client-right-rail">
            <section
              className="client-panel client-activity"
              id="notifications"
            >
              <SectionHeader
                eyebrow="LIVE UPDATES"
                title="Recent Activity"
              />

              {activity.length === 0 ? (
                <p className="client-empty">
                  No recent activity.
                </p>
              ) : (
                activity.map((item) => (
                  <button
                    type="button"
                    className={`client-activity-row ${
                      item.unread
                        ? "is-unread"
                        : ""
                    }`}
                    key={item.id}
                    onClick={() =>
                      item.notificationId &&
                      markRead(item.notificationId)
                    }
                  >
                    <span className="client-activity-dot" />

                    <span>
                      {item.text}

                      <small>
                        {formatDate(item.date)}
                        {item.unread
                          ? " · New"
                          : ""}
                      </small>
                    </span>
                  </button>
                ))
              )}
            </section>

            <section className="client-panel client-events-preview">
              <SectionHeader
                eyebrow="EVENTS"
                title="Opportunities"
                action="View All"
                onAction={() =>
                  navigate("/events")
                }
              />

              {publicEvents
                .slice(0, 3)
                .map((event) => (
                  <button
                    type="button"
                    className="client-opportunity"
                    key={event.id}
                    onClick={() =>
                      navigate("/events")
                    }
                  >
                    <strong>
                      {event.title}
                    </strong>

                    <span>
                      {event.eventType} ·{" "}
                      {event.location}
                    </span>

                    <small>
                      {formatDate(
                        event.startDate
                      )}
                    </small>
                  </button>
                ))}

              {publicEvents.length === 0 && (
                <p className="client-empty">
                  No approved events available.
                </p>
              )}
            </section>
          </aside>
        </div>

        <MyEvents events={events} onCreate={openCreateProject} />

        {/* ALL BOOKINGS */}
        <section
          className="client-panel client-bookings"
          id="bookings"
        >
          <div className="client-project-heading">
            <div>
              <p className="client-eyebrow">
                BOOKINGS
              </p>

              <h2>All Bookings</h2>

              <p className="client-panel-caption">
                View pending, confirmed and declined
                talent requests.
              </p>
            </div>

            <span className="client-ai-count">
              {bookingCounts.all}{" "}
              {bookingCounts.all === 1
                ? "Booking"
                : "Bookings"}
            </span>
          </div>

          {/* BOOKING FILTERS */}
          <div className="client-filter-bar">
            {bookingFilters.map((filter) => (
              <button
                type="button"
                key={filter}
                className={
                  bookingFilter === filter
                    ? "is-selected"
                    : ""
                }
                onClick={() =>
                  setBookingFilter(filter)
                }
              >
                {filter}

                {filter === "All" && (
                  <span className="client-filter-count">
                    {bookingCounts.all}
                  </span>
                )}

                {filter === "Pending" && (
                  <span className="client-filter-count">
                    {bookingCounts.pending}
                  </span>
                )}

                {filter === "Confirmed" && (
                  <span className="client-filter-count">
                    {bookingCounts.confirmed}
                  </span>
                )}

                {filter === "Declined" && (
                  <span className="client-filter-count">
                    {bookingCounts.declined}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="client-booking-list">
            {filteredBookings.length === 0 ? (
              <p className="client-empty">
                {bookingFilter === "Pending"
                  ? "No pending bookings."
                  : bookingFilter ===
                    "Confirmed"
                  ? "No confirmed bookings."
                  : bookingFilter ===
                    "Declined"
                  ? "No declined bookings."
                  : "No bookings found."}
              </p>
            ) : (
              filteredBookings.map(
                (booking) => {
                  const status =
                    normalizeBookingStatus(
                      booking.status
                    );

                  return (
                    <article
                      className="client-booking-row"
                      key={booking.id}
                    >
                      <div className="client-booking-main">
                        <span
                          className={`client-status client-status-${status.toLowerCase()}`}
                        >
                          {status}
                        </span>

                        <h3>
                          {booking.requesterName ||
                            `${booking.requesterRole || "Talent"}`}
                        </h3>

                        <p>
                          {booking.requesterRole ||
                            "Talent"}
                        </p>
                      </div>

                      <div className="client-booking-event">
                        <strong>
                          {booking.eventTitle ||
                            "Project"}
                        </strong>

                        <span>
                          {booking.eventType ||
                            "Event"}
                        </span>

                        <small>
                          {formatDate(
                            booking.startDate
                          )}
                          {booking.location
                            ? ` · ${booking.location}`
                            : ""}
                        </small>
                      </div>

                      <div className="client-booking-actions">
                        {booking.eventId && (
                          <button
                            type="button"
                            className="client-secondary-button"
                            onClick={() =>
                              navigate(
                                `/client-portal/ai-matches/${booking.eventId}`
                              )
                            }
                          >
                            View Project
                          </button>
                        )}

                        
{status === "Pending" && (
  <span className="client-booking-waiting">
    {booking.requesterRole === "photographer"
      ? "Waiting for photographer response"
      : "Waiting for model response"}
  </span>
)}


{status === "Confirmed" && (
  <span className="client-booking-confirmed">
    Booking confirmed
  </span>
)}

{status === "Declined" && (
  <span className="client-booking-declined">
    Model declined
  </span>
)}
                      </div>
                    </article>
                  );
                }
              )
            )}
          </div>
        </section>

        {/* MESSAGES + SAVED TALENT */}
        <div className="client-bottom-grid">
          <section
            className="client-panel"
            id="messages"
          >
            <SectionHeader
              eyebrow="COMMUNICATION"
              title="Messages"
            />

            <p className="client-empty">
              Private direct messages are not available
              in the current application yet.
            </p>
            <button
              type="button"
              className="client-text-button"
              onClick={() => goTo("event-chats")}
            >
              Open event group chats <span>→</span>
            </button>
          </section>

          <section
            className="client-panel"
            id="saved-talent"
          >
            <SectionHeader
              eyebrow="SHORTLIST"
              title="Saved Talent"
            />

            <p className="client-empty">
              Saved-talent persistence is not
              available in the current application.
            </p>

            <BrowseTalentLinks />
          </section>
        </div>

        {/* PARTICIPATION REQUESTS */}
        <section
          className="client-panel client-requests"
          id="requests"
        >
          <SectionHeader
            eyebrow="PENDING REVIEW"
            title="Participation Requests"
          />

          {requests.length === 0 ? (
            <p className="client-empty">
              No pending participation requests.
            </p>
          ) : (
            requests.map((request) => (
              <div
                className="client-request-row"
                key={request.id}
              >
                <span>
                  <strong>
                    {request.requesterRole}
                  </strong>{" "}
                  requested to join{" "}
                  <strong>
                    {request.eventTitle}
                  </strong>
                </span>

                <span>
                  <button
                    type="button"
                    className="client-mini-primary"
                    onClick={() =>
                      reviewRequest(
                        request.id,
                        "confirmed"
                      )
                    }
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    className="client-mini-secondary"
                    onClick={() =>
                      reviewRequest(
                        request.id,
                        "declined"
                      )
                    }
                  >
                    Decline
                  </button>
                </span>
              </div>
            ))
          )}
        </section>
      </main>

      {/* CREATE / EDIT PROJECT MODAL */}
      {isProjectModalOpen && (
        <div
          className="client-modal-backdrop"
          role="presentation"
        >
          <section
            className="client-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
          >
            <button
              type="button"
              className="client-modal-close"
              aria-label="Close"
              onClick={closeProjectModal}
            >
              ×
            </button>

            <p className="client-eyebrow">
              EVENT WORKFLOW
            </p>

            <h2 id="project-modal-title">
              {editingEvent
                ? "Edit Project"
                : "Create New Project"}
            </h2>

            <form onSubmit={saveProject}>
              <div className="client-modal-grid">
                <label>
                  Project name

                  <input
                    required
                    value={projectForm.title}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        title:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Project type

                  <select
                    value={projectForm.eventType}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        eventType:
                          event.target.value,
                      })
                    }
                  >
                    <option>Event</option>
                    <option>Runway</option>
                    <option>Editorial</option>
                    <option>Commercial</option>
                  </select>
                </label>

                <label>
                  Start date

                  <input
                    required
                    type="datetime-local"
                    value={projectForm.startDate}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        startDate:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  End date

                  <input
                    type="datetime-local"
                    value={projectForm.endDate}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        endDate:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Location

                  <input
                    required
                    value={projectForm.location}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        location:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Required gender

                  <select
                    value={
                      projectForm.requiredGender
                    }
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        requiredGender:
                          event.target.value,
                      })
                    }
                  >
                    <option value="">
                      Any gender
                    </option>
                    <option value="Female">
                      Female
                    </option>
                    <option value="Male">
                      Male
                    </option>
                    <option value="Other">
                      Other
                    </option>
                  </select>
                </label>

                <label>
                  Minimum age

                  <input
                    type="number"
                    min="0"
                    value={projectForm.minAge}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        minAge:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Maximum age

                  <input
                    type="number"
                    min="0"
                    value={projectForm.maxAge}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        maxAge:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Minimum height (cm)

                  <input
                    type="number"
                    min="0"
                    value={
                      projectForm.minHeight
                    }
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        minHeight:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Maximum height (cm)

                  <input
                    type="number"
                    min="0"
                    value={
                      projectForm.maxHeight
                    }
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        maxHeight:
                          event.target.value,
                      })
                    }
                  />
                </label>


<MultiSelect
  label="Categories"
  options={CATEGORY_OPTIONS}
  value={projectForm.requiredCategories}
  disabled={savingProject}
  onChange={(value) =>
    setProjectForm((previous) => ({
      ...previous,
      requiredCategories: value,
    }))
  }
/>

<MultiSelect
  label="Skills"
  options={SKILL_OPTIONS}
  value={projectForm.requiredSkills}
  disabled={savingProject}
  onChange={(value) =>
    setProjectForm((previous) => ({
      ...previous,
      requiredSkills: value,
    }))
  }
/>

              </div>

              <label>
                Description

                <textarea
                  required
                  value={projectForm.description}
                  onChange={(event) =>
                    setProjectForm({
                      ...projectForm,
                      description:
                        event.target.value,
                    })
                  }
                />
              </label>

              <div className="client-modal-actions">
                <button
                  type="button"
                  className="client-secondary-button"
                  onClick={closeProjectModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="client-primary-button"
                  disabled={savingProject}
                >
                  {savingProject
                    ? "Saving…"
                    : editingEvent
                    ? "Save Changes"
                    : "Create Project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
