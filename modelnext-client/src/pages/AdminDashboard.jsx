import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  API_BASE_URL,
  SERVER_BASE_URL,
} from "../api";

import { useAuth } from "../context/AuthContext";

import AdminSectionCard from "../components/admin-dashboard/AdminSectionCard";

import AdminSidebar from "../components/admin-dashboard/AdminSidebar";

import AdminStatCard from "../components/admin-dashboard/AdminStatCard";

import "../styles/AdminDashboard.css";


const ADMIN_API_BASE_URL = `${API_BASE_URL}/admin`;

const requestOptions = (options = {}) => ({
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
  ...options,
});


const roleOrder = [
  "model",
  "photographer",
  "agency",
  "client",
];


const formatRole = (role) =>
  role
    ? `${role.charAt(0).toUpperCase()}${role.slice(1)}`
    : "Registration";


const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
      )
    : "—";


function EvidenceImage({ url, label }) {
  return (
    <figure className="identity-evidence-image">
      {url ? (
        <img
          src={`${SERVER_BASE_URL}${url}`}
          alt={label}
        />
      ) : (
        <div className="identity-evidence-missing">
          Not available
        </div>
      )}

      <figcaption>
        {label}
      </figcaption>
    </figure>
  );
}


function StatusBadge({ status }) {
  return (
    <span
      className={`admin-status status-${
        status || "unknown"
      }`}
    >
      {status || "unknown"}
    </span>
  );
}


export default function AdminDashboard() {
  const navigate = useNavigate();

  const { logout } = useAuth();

  const [
    authState,
    setAuthState,
  ] = useState({
    status: "checking",
    admin: null,
    error: "",
  });

  const [
    registrations,
    setRegistrations,
  ] = useState([]);

  const [
    events,
    setEvents,
  ] = useState([]);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    updatingId,
    setUpdatingId,
  ] = useState(null);

  const [
    identityReview,
    setIdentityReview,
  ] = useState(null);

  const [
    reviewLoadingId,
    setReviewLoadingId,
  ] = useState(null);

  const [
    activeView,
    setActiveView,
  ] = useState("overview");

  const [
    query,
    setQuery,
  ] = useState("");


  const loadDashboard = useCallback(
    async () => {
      const registrationResponse =
        await fetch(
          `${ADMIN_API_BASE_URL}/registrations`,
          requestOptions()
        );

      const registrationData =
        await registrationResponse.json();

      if (!registrationResponse.ok) {
        throw new Error(
          registrationData.error ||
            "Unable to load registration applications."
        );
      }

      setRegistrations(
        registrationData.registrations || []
      );


      const eventsResponse =
        await fetch(
          `${ADMIN_API_BASE_URL}/events`,
          requestOptions()
        );

      const eventsData =
        await eventsResponse.json();

      if (eventsResponse.ok) {
        setEvents(
          eventsData.events || []
        );
      }
    },
    []
  );


  useEffect(() => {
    const verifyAndLoad = async () => {
      try {
        const response =
          await fetch(
            `${ADMIN_API_BASE_URL}/me`,
            requestOptions()
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Administrator authentication failed."
          );
        }

        setAuthState({
          status: "authorized",
          admin: data.admin,
          error: "",
        });

        await loadDashboard();
      } catch (error) {
        setAuthState({
          status: "unauthorized",
          admin: null,
          error:
            error.message ||
            "Administrator authentication failed.",
        });
      }
    };

    verifyAndLoad();
  }, [loadDashboard]);


  const counts = useMemo(
    () =>
      registrations.reduce(
        (result, registration) => {
          result.total += 1;

          result[
            registration.approvalStatus
          ] =
            (result[
              registration.approvalStatus
            ] || 0) + 1;

          result.roles[
            registration.role
          ] =
            (result.roles[
              registration.role
            ] || 0) + 1;

          return result;
        },
        {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          roles: {},
        }
      ),
    [registrations]
  );


  const visibleRegistrations =
    useMemo(() => {
      const normalizedQuery =
        query.trim().toLowerCase();

      return registrations.filter(
        (registration) => {
          const matchesView =
            activeView === "overview" ||
            (
              activeView === "pending" &&
              registration.approvalStatus ===
                "pending"
            ) ||
            (
              roleOrder.includes(
                activeView
              ) &&
              registration.role ===
                activeView
            );

          const searchable =
            `${registration.name || ""} ${
              registration.email || ""
            } ${
              registration.role || ""
            }`.toLowerCase();

          return (
            matchesView &&
            (
              !normalizedQuery ||
              searchable.includes(
                normalizedQuery
              )
            )
          );
        }
      );
    }, [
      activeView,
      query,
      registrations,
    ]);


  const pendingModels =
    useMemo(
      () =>
        registrations.filter(
          (registration) =>
            registration.role ===
              "model" &&
            registration.approvalStatus ===
              "pending"
        ),
      [registrations]
    );


  const updateRegistration = async (
    registration,
    decision
  ) => {
    setUpdatingId(
      registration.id
    );

    setLoadError("");

    try {
      const response =
        await fetch(
          `${ADMIN_API_BASE_URL}/registrations/${registration.role}/${registration.id}/${decision}`,
          requestOptions({
            method: "PATCH",
            body: JSON.stringify({}),
          })
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update registration application."
        );
      }

      setRegistrations(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              data.registration.id
                ? data.registration
                : item
          )
      );

      setIdentityReview(
        (current) =>
          current?.registration.id ===
          data.registration.id
            ? {
                ...current,
                registration:
                  data.registration,
              }
            : current
      );
    } catch (error) {
      setLoadError(
        error.message ||
          "Unable to update registration application."
      );
    } finally {
      setUpdatingId(null);
    }
  };


  /*
   * EVENT APPROVAL / REJECTION
   *
   * This is the only new event-management
   * functionality added.
   */
  const updateEvent = async (
    event,
    decision
  ) => {
    setUpdatingId(
      event._id
    );

    setLoadError("");

    try {
      const response =
        await fetch(
          `${ADMIN_API_BASE_URL}/events/${event._id}/${decision}`,
          requestOptions({
            method: "PATCH",
            body: JSON.stringify({}),
          })
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update event."
        );
      }

      setEvents(
        (current) =>
          current.map(
            (item) =>
              item._id ===
              data.event._id
                ? data.event
                : item
          )
      );
    } catch (error) {
      setLoadError(
        error.message ||
          "Unable to update event."
      );
    } finally {
      setUpdatingId(null);
    }
  };


  const openIdentityReview = async (
    registration
  ) => {
    setReviewLoadingId(
      registration.id
    );

    setLoadError("");

    try {
      const response =
        await fetch(
          `${ADMIN_API_BASE_URL}/registrations/model/${registration.id}/identity-review`,
          requestOptions()
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load identity verification evidence."
        );
      }

      setIdentityReview(data);
    } catch (error) {
      setLoadError(
        error.message ||
          "Unable to load identity verification evidence."
      );
    } finally {
      setReviewLoadingId(null);
    }
  };


  if (
    authState.status ===
    "checking"
  ) {
    return (
      <main className="admin-page admin-auth-state">
        <div className="admin-auth-card">
          Verifying administrator session…
        </div>
      </main>
    );
  }


  if (
    authState.status !==
    "authorized"
  ) {
    return (
      <main className="admin-page admin-auth-state">
        <section className="admin-auth-card">
          <p>
            MODELNEXT · ADMINISTRATION
          </p>

          <h1>
            Administrator sign-in required
          </h1>

          <span>
            {authState.error}
          </span>

          <button
            type="button"
            className="admin-primary-button"
            onClick={() =>
              navigate("/login")
            }
          >
            Go to login
          </button>
        </section>
      </main>
    );
  }


  return (
    <main className="admin-page">

      <AdminSidebar
        activeView={activeView}
        onNavigate={setActiveView}
        pendingCount={counts.pending}
      />


      <div className="admin-workspace">

        <header className="admin-topbar">

          <div>
            <p>
              CONTROL ROOM
            </p>

            <h1>
              Administration overview
            </h1>
          </div>


          <div className="admin-topbar-actions">

            <button
              type="button"
              className="admin-topbar-link"
              onClick={() =>
                navigate("/")
              }
            >
              Home
            </button>


            <button
              type="button"
              className="admin-topbar-link"
              onClick={() =>
                setActiveView(
                  "overview"
                )
              }
            >
              Dashboard
            </button>


            <div className="admin-user-summary">
              <span>
                Administrator
              </span>

              <strong>
                {authState.admin.name}
              </strong>
            </div>


            <button
              type="button"
              className="admin-topbar-logout"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
            >
              Logout
            </button>

          </div>

        </header>


        <div className="admin-content">

          <section className="admin-intro">

            <div>

              <p>
                MODELNEXT PLATFORM
              </p>

              <h2>
                Registration and identity review
              </h2>

              <span>
                Live registration, approval,
                and event information from the
                current platform database.
              </span>

            </div>


            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => {
                setActiveView(
                  "pending"
                );
                setQuery("");
              }}
            >
              Review pending{" "}
              <b>
                {counts.pending}
              </b>
            </button>

          </section>


          <section
            className="admin-stat-grid"
            aria-label="Registration overview"
          >

            <AdminStatCard
              label="All registrations"
              value={counts.total}
              detail="Across active application roles"
            />

            <AdminStatCard
              label="Pending review"
              value={counts.pending}
              detail="Awaiting an administrator decision"
              tone="pending"
            />

            <AdminStatCard
              label="Approved"
              value={counts.approved}
              detail="Active platform registrations"
              tone="approved"
            />

            <AdminStatCard
              label="Rejected"
              value={counts.rejected}
              detail="Closed registration decisions"
              tone="rejected"
            />

          </section>


          <section className="admin-overview-grid">

            <AdminSectionCard
              eyebrow="REGISTRATION STATUS"
              title="Approval overview"
              className="admin-status-overview"
            >

              <div
                className="status-chart"
                aria-label="Registration status distribution"
              >

                {[
                  "pending",
                  "approved",
                  "rejected",
                ].map(
                  (status) => {
                    const value =
                      counts[status] ||
                      0;

                    const width =
                      counts.total
                        ? Math.max(
                            (value /
                              counts.total) *
                              100,
                            value
                              ? 5
                              : 0
                          )
                        : 0;

                    return (
                      <div
                        className="status-chart-row"
                        key={status}
                      >

                        <span>
                          {status}
                        </span>

                        <div>
                          <i
                            className={`chart-fill chart-${status}`}
                            style={{
                              width: `${width}%`,
                            }}
                          />
                        </div>

                        <b>
                          {value}
                        </b>

                      </div>
                    );
                  }
                )}

              </div>

            </AdminSectionCard>


            <AdminSectionCard
              eyebrow="ROLE DISTRIBUTION"
              title="Platform registrations"
              className="admin-role-overview"
            >

              <div className="role-summary-grid">

                {roleOrder.map(
                  (role) => (
                    <button
                      type="button"
                      key={role}
                      onClick={() =>
                        setActiveView(
                          role
                        )
                      }
                    >

                      <span>
                        {formatRole(
                          role
                        )}
                      </span>

                      <strong>
                        {counts.roles[
                          role
                        ] || 0}
                      </strong>

                    </button>
                  )
                )}

              </div>

            </AdminSectionCard>

          </section>


          <section className="admin-overview-grid admin-overview-lower">

            <AdminSectionCard
              eyebrow="IDENTITY REVIEW QUEUE"
              title="Pending model review"
              action={
                <button
                  type="button"
                  className="admin-text-button"
                  onClick={() =>
                    setActiveView(
                      "pending"
                    )
                  }
                >
                  View queue
                </button>
              }
            >

              {pendingModels.length ? (

                <div className="admin-queue-list">

                  {pendingModels
                    .slice(0, 4)
                    .map(
                      (
                        registration
                      ) => (
                        <div
                          key={
                            registration.id
                          }
                          className="admin-queue-item"
                        >

                          <div>
                            <strong>
                              {
                                registration.name
                              }
                            </strong>

                            <span>
                              {
                                registration.email
                              }
                            </span>
                          </div>


                          <button
                            type="button"
                            className="review-btn"
                            onClick={() =>
                              openIdentityReview(
                                registration
                              )
                            }
                          >
                            Review identity
                          </button>

                        </div>
                      )
                    )}

                </div>

              ) : (

                <div className="admin-empty-compact">
                  No pending Model identity reviews.
                </div>

              )}

            </AdminSectionCard>


            <AdminSectionCard
              eyebrow="EVENT ACTIVITY"
              title="Current events"
              action={
                <button
                  type="button"
                  className="admin-text-button"
                  onClick={() =>
                    setActiveView(
                      "events"
                    )
                  }
                >
                  View events
                </button>
              }
            >

              <div className="admin-event-summary">

                <strong>
                  {events.length}
                </strong>

                <span>
                  {events.length === 1
                    ? "event returned by the platform"
                    : "events returned by the platform"}
                </span>

                <p>
                  {events.length
                    ? "Event decisions continue to use the existing protected workflow."
                    : "No events are currently returned by the platform."}
                </p>

              </div>

            </AdminSectionCard>

          </section>


          <AdminSectionCard
            eyebrow={
              activeView === "events"
                ? "EVENT DIRECTORY"
                : "REGISTRATION DIRECTORY"
            }
            title={
              activeView === "events"
                ? "Current events"
                : `${
                    activeView ===
                    "overview"
                      ? "All"
                      : formatRole(
                          activeView
                        )
                  } registrations`
            }
            className="admin-directory-card"
            action={
              activeView !==
                "events" && (
                <label className="admin-search">

                  <span>
                    Search
                  </span>

                  <input
                    value={query}
                    onChange={(
                      event
                    ) =>
                      setQuery(
                        event.target.value
                      )
                    }
                    placeholder="Name, email, or role"
                  />

                </label>
              )
            }
          >

            {loadError && (
              <div
                className="admin-inline-error"
                role="alert"
              >
                {loadError}
              </div>
            )}


            {activeView ===
            "events" ? (

              events.length ? (

                <div className="admin-events-list">

                  {events.map(
                    (event) => (
                      <article
                        key={
                          event._id
                        }
                        className="admin-event-row"
                      >

                        <div className="admin-event-info">

                          <strong>
                            {event.title ||
                              "Untitled event"}
                          </strong>

                          <span>
                            {event.location ||
                              "Location not provided"}
                          </span>

                          <small>
                            {event.eventType ||
                              "Event"}
                          </small>

                        </div>


                        <div className="admin-event-actions">

                          <StatusBadge
                            status={
                              event.status
                            }
                          />


                          {event.status ===
                            "pending" && (
                            <>

                              <button
                                type="button"
                                className="approve-btn"
                                disabled={
                                  updatingId ===
                                  event._id
                                }
                                onClick={() =>
                                  updateEvent(
                                    event,
                                    "approve"
                                  )
                                }
                              >
                                {updatingId ===
                                event._id
                                  ? "Approving..."
                                  : "Approve"}
                              </button>


                              <button
                                type="button"
                                className="reject-btn"
                                disabled={
                                  updatingId ===
                                  event._id
                                }
                                onClick={() =>
                                  updateEvent(
                                    event,
                                    "reject"
                                  )
                                }
                              >
                                {updatingId ===
                                event._id
                                  ? "Updating..."
                                  : "Reject"}
                              </button>

                            </>
                          )}


                          {event.status ===
                            "approved" && (
                            <span className="admin-event-approved">
                              ✓ Approved
                            </span>
                          )}


                          {event.status ===
                            "rejected" && (
                            <span className="admin-event-rejected">
                              Rejected
                            </span>
                          )}

                        </div>

                      </article>
                    )
                  )}

                </div>

              ) : (

                <div className="empty-state">
                  No events are currently available.
                </div>

              )

            ) : visibleRegistrations.length ? (

              <div className="admin-table-wrapper">

                <table className="admin-table">

                  <thead>

                    <tr>
                      <th>
                        Applicant
                      </th>

                      <th>
                        Role
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Submitted
                      </th>

                      <th>
                        Review actions
                      </th>
                    </tr>

                  </thead>


                  <tbody>

                    {visibleRegistrations.map(
                      (
                        registration
                      ) => (

                        <tr
                          key={`${registration.role}-${registration.id}`}
                        >

                          <td>

                            <strong>
                              {
                                registration.name
                              }
                            </strong>

                            <span>
                              {
                                registration.email
                              }
                            </span>

                          </td>


                          <td>

                            <span
                              className={`role-badge ${registration.role}`}
                            >
                              {
                                registration.role
                              }
                            </span>

                          </td>


                          <td>

                            <StatusBadge
                              status={
                                registration.approvalStatus
                              }
                            />

                          </td>


                          <td>
                            {formatDate(
                              registration.createdAt
                            )}
                          </td>


                          <td>

                            <div className="table-actions">

                              {registration.role ===
                                "model" && (
                                <button
                                  type="button"
                                  className="review-btn"
                                  disabled={
                                    reviewLoadingId ===
                                    registration.id
                                  }
                                  onClick={() =>
                                    openIdentityReview(
                                      registration
                                    )
                                  }
                                >
                                  {reviewLoadingId ===
                                  registration.id
                                    ? "Loading…"
                                    : "Review identity"}
                                </button>
                              )}


                              <button
                                type="button"
                                className="approve-btn"
                                disabled={
                                  registration.approvalStatus !==
                                    "pending" ||
                                  updatingId ===
                                    registration.id
                                }
                                onClick={() =>
                                  updateRegistration(
                                    registration,
                                    "approve"
                                  )
                                }
                              >
                                Approve
                              </button>


                              <button
                                type="button"
                                className="reject-btn"
                                disabled={
                                  registration.approvalStatus !==
                                    "pending" ||
                                  updatingId ===
                                    registration.id
                                }
                                onClick={() =>
                                  updateRegistration(
                                    registration,
                                    "reject"
                                  )
                                }
                              >
                                Reject
                              </button>

                            </div>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            ) : (

              <div className="empty-state">
                No matching registration applications were found.
              </div>

            )}

          </AdminSectionCard>


          {identityReview && (

            <section
              className="identity-review-dossier"
              aria-labelledby="identity-review-title"
            >

              <div className="identity-review-heading">

                <div>

                  <p>
                    MODEL REGISTRATION · IDENTITY VERIFICATION
                  </p>

                  <h2 id="identity-review-title">
                    Identity review dossier
                  </h2>

                  <span>
                    Manual visual comparison only — this workflow does not perform automatic biometric face matching.
                  </span>

                </div>


                <button
                  type="button"
                  className="review-close"
                  onClick={() =>
                    setIdentityReview(
                      null
                    )
                  }
                >
                  Close
                </button>

              </div>


              <div className="identity-review-section">

                <div className="identity-section-title">

                  <p>
                    DOCUMENT EVIDENCE
                  </p>

                  <h3>
                    Uploaded identity document
                  </h3>

                </div>


                <div className="identity-image-grid identity-document-grid">

                  <EvidenceImage
                    url={
                      identityReview
                        .identityReview
                        .document
                        .frontUrl
                    }
                    label="ID document · Front"
                  />

                  <EvidenceImage
                    url={
                      identityReview
                        .identityReview
                        .document
                        .backUrl
                    }
                    label="ID document · Back"
                  />

                </div>


                <div className="identity-verification-status">

                  <strong>
                    OCR Verification
                  </strong>

                  <span>
                    {
                      identityReview
                        .identityReview
                        .ocr
                        .status ===
                      "identity_verified"
                        ? "✓ Passed"
                        : identityReview
                            .identityReview
                            .ocr
                            .status
                    }
                  </span>

                  <p>
                    {
                      identityReview
                        .identityReview
                        .ocr
                        .summary
                    }
                  </p>


                  {identityReview
                    .identityReview
                    .ocr
                    .checks && (
                    <small>
                      Name:{" "}
                      {identityReview
                        .identityReview
                        .ocr
                        .checks
                        .nameMatched
                        ? "matched"
                        : "not matched"}{" "}
                      · Date of birth:{" "}
                      {identityReview
                        .identityReview
                        .ocr
                        .checks
                        .dateOfBirthMatched
                        ? "matched"
                        : "not matched"}
                    </small>
                  )}

                </div>

              </div>


              <div className="identity-review-section">

                <div className="identity-section-title">

                  <p>
                    REGISTERED IDENTITY
                  </p>

                  <h3>
                    Profile and portfolio
                  </h3>

                </div>


                <div className="identity-image-grid">

                  <EvidenceImage
                    url={
                      identityReview
                        .identityReview
                        .registeredIdentity
                        .profileImageUrl
                    }
                    label="Profile picture"
                  />


                  {identityReview
                    .identityReview
                    .registeredIdentity
                    .portfolioImageUrls
                    .map(
                      (
                        url,
                        index
                      ) => (
                        <EvidenceImage
                          key={url}
                          url={url}
                          label={`Portfolio image ${
                            index + 1
                          }`}
                        />
                      )
                    )}

                </div>

              </div>


              <div className="identity-review-section">

                <div className="identity-section-title">

                  <p>
                    LIVE VERIFICATION
                  </p>

                  <h3>
                    Successful liveness captures
                  </h3>

                </div>


                <div className="identity-image-grid identity-live-grid">

                  <EvidenceImage
                    url={
                      identityReview
                        .identityReview
                        .liveness
                        .frontUrl
                    }
                    label="FRONT · Front view"
                  />

                  <EvidenceImage
                    url={
                      identityReview
                        .identityReview
                        .liveness
                        .leftUrl
                    }
                    label="LEFT · Left view"
                  />

                  <EvidenceImage
                    url={
                      identityReview
                        .identityReview
                        .liveness
                        .rightUrl
                    }
                    label="RIGHT · Right view"
                  />

                </div>


                <div className="identity-verification-status">

                  <strong>
                    Liveness Verification
                  </strong>

                  <span>
                    {
                      identityReview
                        .identityReview
                        .liveness
                        .status ===
                      "completed"
                        ? "✓ Passed"
                        : "Not available"
                    }
                  </span>

                </div>

              </div>


              <div className="identity-review-actions">

                <div>

                  <p>
                    IDENTITY REVIEW
                  </p>

                  <strong>
                    Status:{" "}
                    {
                      identityReview
                        .registration
                        .approvalStatus ===
                      "pending"
                        ? "Pending Admin Review"
                        : identityReview
                            .registration
                            .approvalStatus
                    }
                  </strong>

                </div>


                <div className="table-actions">

                  <button
                    type="button"
                    className="approve-btn"
                    disabled={
                      identityReview
                        .registration
                        .approvalStatus !==
                        "pending" ||
                      updatingId ===
                        identityReview
                          .registration
                          .id
                    }
                    onClick={() =>
                      updateRegistration(
                        identityReview.registration,
                        "approve"
                      )
                    }
                  >
                    Approve &amp; Activate
                  </button>


                  <button
                    type="button"
                    className="reject-btn"
                    disabled={
                      identityReview
                        .registration
                        .approvalStatus !==
                        "pending" ||
                      updatingId ===
                        identityReview
                          .registration
                          .id
                    }
                    onClick={() =>
                      updateRegistration(
                        identityReview.registration,
                        "reject"
                      )
                    }
                  >
                    Reject Registration
                  </button>

                </div>

              </div>

            </section>

          )}

        </div>

      </div>

    </main>
  );
}