import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiFetch, readJson } from "../api";

const pageStyle = {
  minHeight: "100vh",
  background: "var(--mn-bg)",
  color: "var(--mn-ivory)",
  padding: "128px 8% 48px",
  boxSizing: "border-box",
};

export default function ProfileDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const name = searchParams.get("name") || "Model";
  const role = searchParams.get("role") || "Fashion model";
  const img = searchParams.get("img") || "";
  const location = searchParams.get("location") || "Sri Lanka";

  // If these exist, the profile was opened from AI Matches.
  const aiEventId = searchParams.get("eventId") || "";
  const aiEventTitle = searchParams.get("eventTitle") || "";
  const aiEventType = searchParams.get("eventType") || "Event";
  const aiEventLocation = searchParams.get("eventLocation") || "";

  const modelId = searchParams.get("modelId") || "";

  const cameFromAI = Boolean(aiEventId);

  const [showBookingModal, setShowBookingModal] = useState(false);

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");

  const [loadingEvents, setLoadingEvents] = useState(false);
  const [booking, setBooking] = useState(false);

  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingError, setBookingError] = useState("");

  /*
   * Open booking modal.
   *
   * AI flow:
   *   The event is already known.
   *   We automatically select it and DO NOT load
   *   the event selector.
   *
   * Normal flow:
   *   There is no eventId.
   *   We load the client's events and allow
   *   the client to select one.
   */
  const openBookingModal = async () => {
    setShowBookingModal(true);
    setBookingMessage("");
    setBookingError("");

    if (!modelId) {
      setBookingError(
        "This model profile cannot be booked because the model ID is missing."
      );
      return;
    }

    // AI MATCH FLOW
    if (cameFromAI) {
      setSelectedEventId(aiEventId);
      return;
    }

    // NORMAL BROWSING FLOW
    setSelectedEventId("");

    try {
      setLoadingEvents(true);

      const data = await readJson(
        await apiFetch("/events/mine")
      );

      const clientEvents = (data.events || []).filter(
        (event) => event.status !== "rejected"
      );

      setEvents(clientEvents);
    } catch (error) {
      setBookingError(
        error.message || "Unable to load your events."
      );
    } finally {
      setLoadingEvents(false);
    }
  };

  const sendBookingRequest = async () => {
    if (!selectedEventId) {
      setBookingError("Please select an event.");
      return;
    }

    try {
      setBooking(false);
      setBookingError("");
      setBookingMessage("");

      const data = await readJson(
        await apiFetch(
          `/events/${selectedEventId}/bookings`,
          {
            method: "POST",
            body: JSON.stringify({
              modelId,
            }),
          }
        )
      );

      setBookingMessage(
        data.message || "Booking request sent successfully."
      );
    } catch (error) {
      setBookingError(
        error.message || "Unable to send the booking request."
      );
    } finally {
      setBooking(false);
    }
  };

  return (
    <>
      <Navbar />

      <main style={pageStyle}>
        <section
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            display: "flex",
            gap: 48,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* MODEL IMAGE */}
          <div
            style={{
              width: 290,
              height: 380,
              background: "var(--mn-surface-raised)",
              borderRadius: 14,
              overflow: "hidden",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            {img ? (
              <img
                src={img}
                alt={name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <span
                style={{
                  color: "var(--mn-burgundy)",
                  fontSize: 76,
                  fontWeight: 700,
                }}
              >
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* MODEL INFORMATION */}
          <div style={{ flex: 1, minWidth: 300 }}>
            <p
              style={{
                color: "var(--mn-burgundy)",
                fontSize: 11,
                letterSpacing: 2,
                fontWeight: 700,
                margin: 0,
              }}
            >
              MODEL PROFILE
            </p>

            <h1
              style={{
                fontSize: 50,
                margin: "8px 0",
                lineHeight: 1.15,
              }}
            >
              {name}
            </h1>

            <p
              style={{
                color: "var(--mn-muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
                margin: "0 0 12px",
              }}
            >
              {role} · {location}
            </p>

            <p
              style={{
                color: "var(--mn-silver)",
                maxWidth: 480,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              This profile was recommended from the approved
              ModelNext talent directory.
            </p>

            {/* BUTTONS */}
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 28,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={openBookingModal}
                style={{
                  border: "1px solid var(--mn-burgundy)",
                  background: "var(--mn-burgundy)",
                  color: "var(--mn-ivory)",
                  padding: "13px 24px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  minWidth: 150,
                }}
              >
                {cameFromAI
                  ? "Book for this Event"
                  : "Book Model"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/contact")}
                style={{
                  border:
                    "1px solid var(--mn-border-strong)",
                  background: "transparent",
                  color: "var(--mn-ivory)",
                  padding: "13px 24px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  minWidth: 130,
                }}
              >
                Message
              </button>
            </div>

            {/* AI EVENT CONTEXT */}
            {cameFromAI && (
              <div
                style={{
                  marginTop: 22,
                  padding: 15,
                  maxWidth: 480,
                  borderRadius: 10,
                  border:
                    "1px solid rgba(192, 0, 60, 0.35)",
                  background:
                    "rgba(192, 0, 60, 0.07)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    color: "var(--mn-burgundy)",
                    fontSize: 9,
                    letterSpacing: 2,
                    fontWeight: 700,
                  }}
                >
                  AI MATCH EVENT
                </p>

                <strong
                  style={{
                    display: "block",
                    fontSize: 14,
                  }}
                >
                  {aiEventTitle || "Selected Event"}
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: 5,
                    color: "var(--mn-muted)",
                    fontSize: 12,
                  }}
                >
                  {aiEventType}
                  {aiEventLocation
                    ? ` · ${aiEventLocation}`
                    : ""}
                </span>

                <p
                  style={{
                    margin: "9px 0 0",
                    color: "var(--mn-silver)",
                    fontSize: 11,
                  }}
                >
                  This model was recommended specifically
                  for this event.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* BOOKING MODAL */}
        {showBookingModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 9999,
            }}
            onClick={() => {
              if (!booking) {
                setShowBookingModal(false);
              }
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                background: "var(--mn-surface)",
                border:
                  "1px solid var(--mn-border-strong)",
                borderRadius: 16,
                padding: 28,
                boxSizing: "border-box",
                boxShadow:
                  "0 20px 60px rgba(0,0,0,.45)",
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* MODAL HEADER */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 20,
                }}
              >
                <div>
                  <p
                    style={{
                      color: "var(--mn-burgundy)",
                      fontSize: 10,
                      letterSpacing: 2,
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    {cameFromAI
                      ? "AI MATCH BOOKING"
                      : "BOOK MODEL"}
                  </p>

                  <h2
                    style={{
                      margin: "7px 0 5px",
                      fontSize: 25,
                    }}
                  >
                    {cameFromAI
                      ? `Book ${name} for this event`
                      : `Book ${name}`}
                  </h2>

                  <p
                    style={{
                      color: "var(--mn-muted)",
                      fontSize: 13,
                      margin: 0,
                    }}
                  >
                    {cameFromAI
                      ? "The event was selected from your AI recommendations."
                      : "Select the event you want this model to participate in."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowBookingModal(false)
                  }
                  disabled={booking}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--mn-muted)",
                    fontSize: 22,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              {/* AI FLOW */}
              {cameFromAI ? (
                <div style={{ marginTop: 25 }}>
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 11,
                      border:
                        "1px solid var(--mn-border)",
                      background:
                        "var(--mn-surface-raised)",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 7px",
                        color: "var(--mn-burgundy)",
                        fontSize: 9,
                        letterSpacing: 2,
                        fontWeight: 700,
                      }}
                    >
                      BOOKING FOR
                    </p>

                    <strong
                      style={{
                        display: "block",
                        fontSize: 17,
                      }}
                    >
                      {aiEventTitle ||
                        "Selected Event"}
                    </strong>

                    <span
                      style={{
                        display: "block",
                        marginTop: 6,
                        color: "var(--mn-muted)",
                        fontSize: 12,
                      }}
                    >
                      {aiEventType}
                      {aiEventLocation
                        ? ` · ${aiEventLocation}`
                        : ""}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 8,
                      background:
                        "rgba(192, 0, 60, 0.07)",
                      color: "var(--mn-silver)",
                      fontSize: 11,
                      lineHeight: 1.5,
                    }}
                  >
                    This event is locked because you opened
                    this model from its AI recommendations.
                    The booking will be sent specifically for
                    this event.
                  </div>
                </div>
              ) : loadingEvents ? (
                /* NORMAL FLOW - LOADING */
                <div
                  style={{
                    padding: "35px 0",
                    textAlign: "center",
                    color: "var(--mn-muted)",
                  }}
                >
                  Loading your events...
                </div>
              ) : events.length === 0 ? (
                /* NORMAL FLOW - NO EVENTS */
                <div
                  style={{
                    marginTop: 24,
                    padding: 18,
                    borderRadius: 10,
                    border:
                      "1px solid var(--mn-border)",
                    background:
                      "var(--mn-surface-raised)",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "var(--mn-silver)",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    You don't have any events available
                    for booking yet. Create an event first.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/event/create")
                    }
                    style={{
                      marginTop: 15,
                      border:
                        "1px solid var(--mn-burgundy)",
                      background:
                        "var(--mn-burgundy)",
                      color: "var(--mn-ivory)",
                      padding: "10px 16px",
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Create Event
                  </button>
                </div>
              ) : (
                /* NORMAL FLOW - SELECT EVENT */
                <>
                  <label
                    htmlFor="booking-event"
                    style={{
                      display: "block",
                      marginTop: 25,
                      marginBottom: 8,
                      color: "var(--mn-ivory)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Select Event
                  </label>

                  <select
                    id="booking-event"
                    value={selectedEventId}
                    onChange={(event) =>
                      setSelectedEventId(
                        event.target.value
                      )
                    }
                    disabled={booking}
                    style={{
                      width: "100%",
                      padding: "13px 14px",
                      borderRadius: 8,
                      border:
                        "1px solid var(--mn-border-strong)",
                      background: "var(--mn-bg)",
                      color: "var(--mn-ivory)",
                      fontSize: 14,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">
                      Select an event
                    </option>

                    {events.map((event) => (
                      <option
                        key={event.id}
                        value={event.id}
                      >
                        {event.title}
                      </option>
                    ))}
                  </select>

                  {selectedEventId && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 14,
                        borderRadius: 9,
                        background:
                          "var(--mn-surface-raised)",
                        border:
                          "1px solid var(--mn-border)",
                      }}
                    >
                      {(() => {
                        const selectedEvent =
                          events.find(
                            (event) =>
                              event.id ===
                              selectedEventId
                          );

                        if (!selectedEvent) {
                          return null;
                        }

                        return (
                          <>
                            <strong
                              style={{
                                display: "block",
                                fontSize: 14,
                              }}
                            >
                              {selectedEvent.title}
                            </strong>

                            <span
                              style={{
                                display: "block",
                                marginTop: 5,
                                color:
                                  "var(--mn-muted)",
                                fontSize: 12,
                              }}
                            >
                              {selectedEvent.eventType}
                              {selectedEvent.location
                                ? ` · ${selectedEvent.location}`
                                : ""}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* ERRORS */}
              {bookingError && (
                <p
                  style={{
                    marginTop: 14,
                    color: "#fb7185",
                    fontSize: 13,
                  }}
                >
                  {bookingError}
                </p>
              )}

              {/* SUCCESS */}
              {bookingMessage && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 8,
                    background:
                      "rgba(52, 211, 153, 0.10)",
                    border:
                      "1px solid rgba(52, 211, 153, 0.35)",
                    color: "#34d399",
                    fontSize: 13,
                  }}
                >
                  {bookingMessage}
                </div>
              )}

              {/* MODAL ACTIONS */}
              {(cameFromAI || events.length > 0) && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 25,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setShowBookingModal(false)
                    }
                    disabled={booking}
                    style={{
                      border:
                        "1px solid var(--mn-border-strong)",
                      background: "transparent",
                      color: "var(--mn-ivory)",
                      padding: "11px 18px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={sendBookingRequest}
                    disabled={
                      booking || !selectedEventId
                    }
                    style={{
                      border:
                        "1px solid var(--mn-burgundy)",
                      background:
                        "var(--mn-burgundy)",
                      color: "var(--mn-ivory)",
                      padding: "11px 20px",
                      borderRadius: 8,
                      cursor:
                        booking || !selectedEventId
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        booking || !selectedEventId
                          ? 0.55
                          : 1,
                      fontWeight: 700,
                    }}
                  >
                    {booking
                      ? "Sending..."
                      : cameFromAI
                      ? "Confirm Booking"
                      : "Send Booking Request"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}