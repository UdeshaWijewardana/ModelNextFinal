
import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch, getCurrentUser, readJson } from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";
import MyEvents from "./MyEvents";
import BrowseTalentLinks from "./BrowseTalentLinks";
import "./AccountDashboard.css";
const fieldsByRole = {
  model: [
    "fullName",
    "username",
    "address",
    "phone",
    "birthdate",
    "location",
    "gender",
    "weight",
    "height",
    "waist",
    "hip",
  ],
  photographer: [
    "name",
    "username",
    "phone",
    "location",
    "experienceYears",
    "portfolio",
  ],
  agency: [
    "agencyName",
    "ownerName",
    "phone",
    "address",
    "businessId",
  ],
};

const statusCopy = {
  pending: {
    title: "PENDING ADMIN APPROVAL",
    message:
      "Your registration has been submitted and is being reviewed by the ModelNext administration team. Profile editing will be enabled after approval.",
  },
  modelPending: {
    title: "PENDING ADMIN APPROVAL",
    message:
      "Your registration has been submitted successfully and is currently pending administrator approval. You can view your submitted profile information, but editing will become available after approval.",
  },
  approved: {
    title: "ACCOUNT APPROVED",
    message:
      "Your ModelNext account has been approved. You can now update your profile information.",
  },
  rejected: {
    title: "REGISTRATION NOT APPROVED",
    message:
      "This registration was not approved. Profile editing is unavailable for this account.",
  },
};

const bookingStatusLabel = (status) => {
  switch (status) {
    case "confirmed":
      return "Accepted";
    case "declined":
      return "Declined";
    default:
      return "Pending";
  }
};

export default function AccountDashboard({ role, title, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [respondingTo, setRespondingTo] = useState("");

  const section =
    new URLSearchParams(location.search).get("section") || "profile";

  useEffect(() => {
    if (user) {
      document
        .getElementById(section)
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [section, user]);

  const load = useCallback(async () => {
    try {
      setError("");

      const { user: current } = await getCurrentUser();

      if (current.role !== role) {
        throw new Error(
          "This account cannot access this dashboard."
        );
      }

      let items = [];
      let requests = [];

      if (current.approvalStatus === "approved") {
        const notificationData = await readJson(
          await apiFetch("/notifications")
        );

        items = notificationData.notifications || [];

        // Booking requests belong to the model or photographer
        // whose profile was selected by the client.
        if (["model", "photographer"].includes(current.role)) {
          const requestData = await readJson(
            await apiFetch("/events/requests/mine")
          );

          requests = (requestData.requests || []).filter(
            (request) =>
              request.requestType === "booking" &&
              ["pending", "confirmed", "declined"].includes(
                request.status
              )
          );
        }
      }

      setUser(current);
      setForm(current);
      setNotifications(items);
      setBookingRequests(requests);
    } catch (err) {
      setError(err.message || "Unable to load your account.");
    }
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();

    if (user.approvalStatus !== "approved") return;

    setSaving(true);
    setError("");

    try {
      const { user: updated } = await readJson(
        await apiFetch("/auth/me/profile", {
          method: "PATCH",
          body: JSON.stringify(form),
        })
      );

      setUser(updated);
      setForm(updated);
    } catch (err) {
      setError(err.message);
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
    } catch (err) {
      setError(err.message);
    }
  };

  const respondToBooking = async (requestId, status) => {
    if (!["confirmed", "declined"].includes(status)) return;

    const action = status === "confirmed" ? "accept" : "decline";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this booking request?`
    );

    if (!confirmed) return;

    setRespondingTo(requestId);
    setError("");

    try {
      const data = await readJson(
        await apiFetch(`/events/bookings/${requestId}/respond`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        })
      );

      setBookingRequests((requests) =>
        requests.map((request) =>
          String(request.id) === String(requestId) ||
          String(request._id) === String(requestId)
            ? { ...request, status: data.request?.status || status }
            : request
        )
      );

      // Refresh notifications so the account displays the latest
      // notification state after responding to a booking.
      try {
        const notificationData = await readJson(
          await apiFetch("/notifications")
        );

        setNotifications(notificationData.notifications || []);
      } catch {
        // The booking response has already succeeded.
      }
    } catch (err) {
      setError(err.message || "Unable to respond to this booking.");
    } finally {
      setRespondingTo("");
    }
  };

  const signOut = async () => {
    await logout();
    navigate("/");
  };

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="account-dashboard">
          {error || "Loading account..."}
        </main>
      </>
    );
  }

  const approvalStatus = user.approvalStatus || "pending";

  const status =
    role === "model" && approvalStatus === "pending"
      ? statusCopy.modelPending
      : statusCopy[approvalStatus] || statusCopy.pending;

  const editable = approvalStatus === "approved";

  const pendingBookingCount = bookingRequests.filter(
    (request) => request.status === "pending"
  ).length;

  return (
    <>
      <Navbar />

      <main className="account-dashboard">
        <h1>{title}</h1>
        <p>{user.name || user.fullName} · {user.email}</p>

        {location.state?.registrationSubmitted && (
          <section
            className="account-status-banner approved"
            role="status"
          >
            <strong>REGISTRATION SUBMITTED SUCCESSFULLY</strong>
            <p>
              Thank you for registering with ModelNext. Your account
              is pending administrator approval. You can review your
              account information while it is being reviewed.
            </p>
          </section>
        )}

        <section
          className={`account-status-banner ${approvalStatus}`}
          role="status"
        >
          <strong>{status.title}</strong>
          <p>{status.message}</p>

          {approvalStatus === "rejected" && user.rejectionReason && (
            <p>
              <strong>Reason:</strong> {user.rejectionReason}
            </p>
          )}
        </section>

        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}

        <nav className="account-section-nav" aria-label="Account navigation">
          <Link
            to="?section=profile"
            aria-current={section === "profile" ? "page" : undefined}
          >
            My Profile
          </Link>

          {["photographer", "agency"].includes(role) && editable && (
            <Link
              to="?section=my-events"
              aria-current={section === "my-events" ? "page" : undefined}
            >
              My Events
            </Link>
          )}

          {editable && <Link to="/event-chats">Event Group Chats</Link>}

          {editable && (
            <Link to="/my-bookings">
              My Bookings
              {pendingBookingCount > 0
                ? ` (${pendingBookingCount} pending)`
                : ""}
            </Link>
          )}

          {editable && <Link to="/my-bookings">Messages</Link>}

          <Link
            to="?section=notifications"
            aria-current={section === "notifications" ? "page" : undefined}
          >
            Notifications
          </Link>

          <Link to="/">Back to Website</Link>
        </nav>

        {["photographer", "agency"].includes(role) && (
          <BrowseTalentLinks />
        )}

        <form
          id="profile"
          className={`account-profile-form ${
            editable ? "is-editable" : "is-locked"
          }`}
          onSubmit={save}
        >
          {!editable && (
            <p className="account-lock-note">
              Your submitted account details are view-only until approval.
            </p>
          )}

          {(fieldsByRole[role] || []).map((field) => (
            <label key={field}>
              {field}
              <input
                disabled={!editable}
                value={form[field] || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    [field]: event.target.value,
                  })
                }
              />
            </label>
          ))}

          {editable && (
            <button disabled={saving} type="submit">
              {saving ? "Saving..." : "Save profile"}
            </button>
          )}
        </form>

        {/* Incoming booking requests for models and photographers */}
        {editable && ["model", "photographer"].includes(role) && (
          <section
            id="booking-requests"
            className="account-booking-requests"
          >
            <h2>Booking Requests</h2>

            <p>
              Clients may invite you to work on their events. Accept or
              decline each pending request below.
            </p>

            {bookingRequests.length === 0 ? (
              <p>No booking requests yet.</p>
            ) : (
              <div className="account-booking-list">
                {bookingRequests.map((request) => {
                  const requestId = request.id || request._id;
                  const isPending = request.status === "pending";
                  const isResponding = respondingTo === requestId;

                  return (
                    <article
                      className="account-booking-card"
                      key={requestId}
                    >
                      <div className="account-booking-details">
                        <h3>
                          {request.eventTitle || "Event booking"}
                        </h3>

                        <p>
                          <strong>Talent type:</strong>{" "}
                          {role === "photographer"
                            ? "Photographer"
                            : "Model"}
                        </p>

                        <p>
                          <strong>Booking status:</strong>{" "}
                          {bookingStatusLabel(request.status)}
                        </p>

                        {request.eventId && (
                          <p>
                            <strong>Event ID:</strong>{" "}
                            {String(request.eventId)}
                          </p>
                        )}
                      </div>

                      {isPending ? (
                        <div className="account-booking-actions">
                          <button
                            type="button"
                            disabled={Boolean(respondingTo)}
                            onClick={() =>
                              respondToBooking(requestId, "confirmed")
                            }
                          >
                            {isResponding ? "Updating..." : "Accept"}
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(respondingTo)}
                            onClick={() =>
                              respondToBooking(requestId, "declined")
                            }
                          >
                            {isResponding ? "Updating..." : "Decline"}
                          </button>
                        </div>
                      ) : (
                        <p className="account-booking-final-status">
                          {request.status === "confirmed"
                            ? "You accepted this booking."
                            : "You declined this booking."}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {editable && children}

        {editable && ["photographer", "agency"].includes(role) && (
          <MyEvents />
        )}

        <h2 id="notifications">Notifications</h2>

        {notifications.length === 0 ? (
          <p>No notifications.</p>
        ) : (
          notifications.map((item) => (
            <p key={item._id}>
              <button
                disabled={item.read}
                onClick={() => markRead(item._id)}
              >
                {item.read ? "Read" : "Mark read"}
              </button>{" "}
              {item.message}
            </p>
          ))
        )}

        <button onClick={signOut}>Logout</button>
      </main>
    </>
  );
}
