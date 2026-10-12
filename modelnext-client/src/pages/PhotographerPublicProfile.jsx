
import React, { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import Navbar from "../components/Navbar";
import { apiFetch, readJson, SERVER_BASE_URL } from "../api";
import BookingForm from "./direct-booking/BookingForm";
import "../styles/ModelPublicProfile.css";

const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const dayKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const imageUrl = (value) => {
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${SERVER_BASE_URL}/${String(value).replace(/^[/\\]+/, "")}`;
};

const initials = (value) =>
  String(value || "Photographer")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const portfolioWebsite = (value) => {
  try {
    const url = new URL(value);

    return /^https?:$/.test(url.protocol) &&
      !/(^|\.)example(\.|$)/i.test(url.hostname)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
};

export default function PhotographerPublicProfile() {
  const { photographerId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Preserve the event selected on the AI recommendations page.
  const eventId = searchParams.get("eventId") || "";

  const eventContext = eventId
    ? {
        eventId,
        eventTitle:
          searchParams.get("eventTitle") || "Selected event",
        eventType:
          searchParams.get("eventType") || "Event",
        eventLocation:
          searchParams.get("eventLocation") || "",
      }
    : null;

  const [photographer, setPhotographer] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(
    () =>
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
  );

  const [availability, setAvailability] = useState({
    bookedDates: [],
    manualDates: [],
    availabilityManaged: false,
  });

  const [availabilityLoading, setAvailabilityLoading] =
    useState(false);

  const [availabilityError, setAvailabilityError] =
    useState("");

  // Load the photographer profile.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setImageFailed(false);

    apiFetch(`/photographers/${photographerId}`)
      .then(readJson)
      .then(({ photographer: profile }) => {
        if (active) {
          setPhotographer(profile);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.message ||
              "Unable to load this photographer profile."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [photographerId]);

  // Load availability when the calendar is opened.
  useEffect(() => {
    if (!open) return undefined;

    let active = true;

    setAvailabilityLoading(true);
    setAvailabilityError("");

    apiFetch(
      `/photographers/${photographerId}/availability?month=${monthKey(month)}`
    )
      .then(readJson)
      .then((data) => {
        if (active) {
          setAvailability(data);
        }
      })
      .catch((requestError) => {
        if (active) {
          setAvailabilityError(
            requestError.message ||
              "Unable to load availability."
          );
        }
      })
      .finally(() => {
        if (active) {
          setAvailabilityLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, month, photographerId]);

  // Prepare calendar days and availability statuses.
  const days = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();

    const booked = new Set(
      availability.bookedDates || []
    );

    const manual = new Map(
      (availability.manualDates || []).map((entry) => [
        entry.date,
        entry.status,
      ])
    );

    const firstWeekday = new Date(
      year,
      monthIndex,
      1
    ).getDay();

    const daysInMonth = new Date(
      year,
      monthIndex + 1,
      0
    ).getDate();

    return [
      ...Array.from(
        { length: firstWeekday },
        (_, index) => ({
          empty: true,
          key: `empty-${index}`,
        })
      ),

      ...Array.from(
        { length: daysInMonth },
        (_, index) => {
          const key = dayKey(
            year,
            monthIndex,
            index + 1
          );

          return {
            key,
            day: index + 1,
            booked: booked.has(key),
            status: booked.has(key)
              ? undefined
              : manual.get(key),
          };
        }
      ),
    ];
  }, [availability, month]);

  const profileImage = imageUrl(
    photographer?.profileImage
  );

  const website = portfolioWebsite(
    photographer?.portfolio
  );

  return (
    <div className="public-model-page">
      <Navbar />

      <main className="public-model-shell">
        <button
          className="public-model-back"
          type="button"
          onClick={() => {
            if (eventContext) {
              navigate(
                `/client-portal/ai-matches/${eventContext.eventId}`
              );
            } else {
              navigate("/photographers");
            }
          }}
        >
          {eventContext
            ? "← Back to Event Recommendations"
            : "← Photographers"}
        </button>

        {loading && (
          <section
            className="public-model-state"
            aria-live="polite"
          >
            Loading photographer profile…
          </section>
        )}

        {!loading && error && (
          <section
            className="public-model-state public-model-state--error"
            role="alert"
          >
            <h1>Profile unavailable</h1>
            <p>{error}</p>
          </section>
        )}

        {!loading && !error && photographer && (
          <>
            <section className="public-model-hero">
              <div className="public-model-portrait">
                {profileImage && !imageFailed ? (
                  <img
                    src={profileImage}
                    alt={`Portrait of ${photographer.name}`}
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <span className="public-model-monogram">
                    {initials(photographer.name)}
                  </span>
                )}
              </div>

              <div className="public-model-information">
                <p className="public-model-kicker">
                  Photographer
                </p>

                <h1>{photographer.name}</h1>

                {photographer.location && (
                  <p className="public-model-location">
                    {photographer.location}
                  </p>
                )}

                {/* Selected event context from AI recommendations */}
                {eventContext && (
                  <aside
                    className="public-model-event-context"
                    aria-label="Selected event"
                  >
                    <p>AI recommendation for</p>

                    <strong>
                      {eventContext.eventTitle}
                    </strong>

                    <span>
                      {eventContext.eventType}
                      {eventContext.eventLocation
                        ? ` · ${eventContext.eventLocation}`
                        : ""}
                    </span>

                    <small>
                      Your selected event will be verified
                      before the booking request is submitted.
                    </small>
                  </aside>
                )}

                {/* Keep the existing booking form and pass event context */}
                <BookingForm
                  talentId={photographerId}
                  talentRole="photographer"
                  talentName={photographer.name}
                  eventContext={eventContext}
                />

                {website && (
                  <p className="public-model-specialties">
                    <a
                      className="public-model-back"
                      href={website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit portfolio website ↗
                    </a>
                  </p>
                )}

                {/* Existing availability feature */}
                <div className="public-model-availability">
                  <button
                    type="button"
                    className="public-model-availability-toggle"
                    aria-expanded={open}
                    onClick={() =>
                      setOpen((value) => !value)
                    }
                  >
                    {open
                      ? "Hide availability"
                      : "Check availability"}
                  </button>

                  <div className="public-model-availability-legend">
                    <span>
                      <i className="availability-dot availability-dot--available" />
                      Available dates
                    </span>

                    <span>
                      <i className="availability-dot availability-dot--booked" />
                      Already booked
                    </span>

                    <span>
                      <i className="availability-dot availability-dot--unavailable" />
                      Manually unavailable
                    </span>

                    <span>
                      <i className="availability-dot availability-dot--unknown" />
                      Not confirmed
                    </span>
                  </div>

                  {open && (
                    <section
                      className="public-model-calendar"
                      aria-label="Photographer availability calendar"
                    >
                      <div className="public-model-calendar-header">
                        <button
                          type="button"
                          aria-label="Previous month"
                          onClick={() =>
                            setMonth(
                              (date) =>
                                new Date(
                                  date.getFullYear(),
                                  date.getMonth() - 1,
                                  1
                                )
                            )
                          }
                        >
                          ←
                        </button>

                        <h2>
                          {month.toLocaleDateString(
                            undefined,
                            {
                              month: "long",
                              year: "numeric",
                            }
                          )}
                        </h2>

                        <button
                          type="button"
                          aria-label="Next month"
                          onClick={() =>
                            setMonth(
                              (date) =>
                                new Date(
                                  date.getFullYear(),
                                  date.getMonth() + 1,
                                  1
                                )
                            )
                          }
                        >
                          →
                        </button>
                      </div>

                      {availabilityLoading ? (
                        <p
                          className="public-model-calendar-message"
                          role="status"
                        >
                          Loading calendar…
                        </p>
                      ) : availabilityError ? (
                        <p
                          className="public-model-calendar-message public-model-calendar-message--error"
                          role="alert"
                        >
                          {availabilityError}
                        </p>
                      ) : (
                        <>
                          <div className="public-model-weekdays">
                            {[
                              "Sun",
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                            ].map((day) => (
                              <span key={day}>{day}</span>
                            ))}
                          </div>

                          <div className="public-model-calendar-grid">
                            {days.map((entry) =>
                              entry.empty ? (
                                <span
                                  className="public-model-calendar-empty"
                                  key={entry.key}
                                />
                              ) : (
                                <span
                                  className={`public-model-calendar-day${
                                    entry.booked
                                      ? " is-booked"
                                      : ""
                                  }${
                                    entry.status
                                      ? ` is-${entry.status}`
                                      : ""
                                  }`}
                                  key={entry.key}
                                  aria-label={`${entry.key}: ${
                                    entry.booked
                                      ? "already booked"
                                      : entry.status === "available"
                                      ? "available"
                                      : entry.status === "unavailable"
                                      ? "manually unavailable"
                                      : "not confirmed"
                                  }`}
                                >
                                  {entry.day}
                                </span>
                              )
                            )}
                          </div>

                          <p className="public-model-calendar-note">
                            Confirmed bookings take priority.{" "}
                            {availability.availabilityManaged
                              ? "Availability preferences are shown where this photographer has set them."
                              : "Other dates are not confirmed."}
                          </p>
                        </>
                      )}
                    </section>
                  )}
                </div>
              </div>
            </section>

            <section className="public-model-portfolio">
              <div className="public-model-section-heading">
                <p>Selected work</p>
                <h2>Portfolio</h2>
              </div>

              <p className="public-model-empty-portfolio">
                No portfolio images added yet.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
