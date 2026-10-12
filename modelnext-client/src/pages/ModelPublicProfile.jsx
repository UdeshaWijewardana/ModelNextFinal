import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiFetch, readJson, SERVER_BASE_URL } from "../api";
import BookingForm from "./direct-booking/BookingForm";
import Reviews from "../components/reviews/Reviews";
import "../styles/ModelPublicProfile.css";

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const imageUrl = (storedPath) => {
  if (!hasValue(storedPath)) return "";
  if (/^https?:\/\//i.test(storedPath)) return storedPath;
  return `${SERVER_BASE_URL}/${String(storedPath).replace(/^[/\\]+/, "")}`;
};

const initials = (name) => String(name || "Model")
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase();

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const dayKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export default function ModelPublicProfile() {
  const { modelId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [failedPortfolioImages, setFailedPortfolioImages] = useState([]);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [availability, setAvailability] = useState({ bookedDates: [], manualDates: [], availabilityManaged: false });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const eventId = searchParams.get("eventId") || "";
  const eventContext = eventId ? {
    eventId,
    eventTitle: searchParams.get("eventTitle") || "Selected event",
    eventType: searchParams.get("eventType") || "Event",
    eventLocation: searchParams.get("eventLocation") || "",
  } : null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setHeroImageFailed(false);
    setFailedPortfolioImages([]);

    apiFetch(`/models/${modelId}`)
      .then(readJson)
      .then(({ model: profile }) => {
        if (active) setModel(profile);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load this model profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [modelId]);

  useEffect(() => {
    if (!availabilityOpen) return undefined;

    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError("");

    apiFetch(`/models/${modelId}/availability?month=${monthKey(calendarMonth)}`)
      .then(readJson)
      .then((data) => {
        if (active) setAvailability(data);
      })
      .catch((requestError) => {
        if (active) setAvailabilityError(requestError.message || "Unable to load availability.");
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [availabilityOpen, calendarMonth, modelId]);

  const profileImage = imageUrl(model?.profileImage);
  const portfolioImages = useMemo(
    () => (model?.portfolioImages || [])
      .map(imageUrl)
      .filter((url) => url && !failedPortfolioImages.includes(url)),
    [model?.portfolioImages, failedPortfolioImages]
  );

  const measurements = [
    ["Height", model?.height],
    ["Weight", model?.weight],
    ["Waist", model?.waist],
    ["Hips", model?.hip],
  ].filter(([, value]) => hasValue(value));

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = dayKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const bookedDates = new Set(availability.bookedDates || []);
    const manualDates = new Map((availability.manualDates || []).map((entry) => [entry.date, entry.status]));

    return [
      ...Array.from({ length: firstWeekday }, (_, index) => ({ empty: true, key: `empty-${index}` })),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const key = dayKey(year, month, day);
        const booked = bookedDates.has(key);
        return { day, key, booked, status: booked ? undefined : manualDates.get(key), past: key < today };
      }),
    ];
  }, [availability.bookedDates, availability.manualDates, calendarMonth]);

  return (
    <div className="public-model-page">
      <Navbar />
      <main className="public-model-shell">
        <button className="public-model-back" type="button" onClick={() => navigate("/models")}>
          ← Fashion models
        </button>

        {loading && (
          <section className="public-model-state" aria-live="polite">
            Loading model profile…
          </section>
        )}

        {!loading && error && (
          <section className="public-model-state public-model-state--error" role="alert">
            <h1>Profile unavailable</h1>
            <p>{error}</p>
            <button type="button" onClick={() => navigate("/models")}>Back to models</button>
          </section>
        )}

        {!loading && !error && model && (
          <>
            <section className="public-model-hero" aria-labelledby="public-model-name">
              <div className="public-model-portrait">
                {profileImage && !heroImageFailed ? (
                  <img
                    src={profileImage}
                    alt={`Portrait of ${model.fullName}`}
                    onError={() => setHeroImageFailed(true)}
                  />
                ) : (
                  <span className="public-model-monogram" aria-label={`${model.fullName} portrait unavailable`}>
                    {initials(model.fullName)}
                  </span>
                )}
              </div>

              <div className="public-model-information">
                <p className="public-model-kicker">ModelNext talent</p>
                <h1 id="public-model-name">{model.fullName}</h1>

                {model.categories?.length > 0 && (
                  <p className="public-model-categories">{model.categories.join(" · ")}</p>
                )}

                {hasValue(model.location) && (
                  <p className="public-model-location">{model.location}</p>
                )}

                {eventContext && <aside className="public-model-event-context" aria-label="AI recommendation event context"><p>AI recommendation for</p><strong>{eventContext.eventTitle}</strong><span>{eventContext.eventType}{eventContext.eventLocation ? ` · ${eventContext.eventLocation}` : ""}</span><small>The event will be verified against your account before booking.</small></aside>}

                <BookingForm talentId={modelId} talentRole="model" talentName={model.fullName} eventContext={eventContext} />

                {measurements.length > 0 && (
                  <dl className="public-model-measurements">
                    {measurements.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {model.skills?.length > 0 && (
                  <div className="public-model-specialties">
                    <p>Specialties</p>
                    <ul>
                      {model.skills.map((skill) => <li key={skill}>{skill}</li>)}
                    </ul>
                  </div>
                )}

                <div className="public-model-availability">
                  <button
                    type="button"
                    className="public-model-availability-toggle"
                    aria-expanded={availabilityOpen}
                    onClick={() => setAvailabilityOpen((open) => !open)}
                  >
                    {availabilityOpen ? "Hide availability" : "Check availability"}
                  </button>

                  <div className="public-model-availability-legend" aria-label="Availability legend">
                    <span><i className="availability-dot availability-dot--available" />Available dates</span>
                    <span><i className="availability-dot availability-dot--booked" />Already booked</span>
                    <span><i className="availability-dot availability-dot--unavailable" />Manually unavailable</span>
                    <span><i className="availability-dot availability-dot--unknown" />Not confirmed</span>
                  </div>

                  {availabilityOpen && (
                    <section className="public-model-calendar" aria-label="Model availability calendar">
                      <div className="public-model-calendar-header">
                        <button
                          type="button"
                          aria-label="Previous month"
                          onClick={() => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
                        >
                          ←
                        </button>
                        <h2>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
                        <button
                          type="button"
                          aria-label="Next month"
                          onClick={() => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
                        >
                          →
                        </button>
                      </div>

                      {availabilityLoading ? (
                        <p className="public-model-calendar-message" aria-live="polite">Loading calendar…</p>
                      ) : availabilityError ? (
                        <p className="public-model-calendar-message public-model-calendar-message--error" role="alert">{availabilityError}</p>
                      ) : (
                        <>
                          <div className="public-model-weekdays" aria-hidden="true">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
                          </div>
                          <div className="public-model-calendar-grid">
                            {calendarDays.map((entry) => entry.empty ? (
                              <span className="public-model-calendar-empty" key={entry.key} />
                            ) : (
                              <span
                                className={`public-model-calendar-day${entry.booked ? " is-booked" : ""}${entry.status ? ` is-${entry.status}` : ""}${entry.past ? " is-past" : ""}`}
                                key={entry.key}
                                aria-label={`${entry.key}: ${entry.booked ? "already booked" : entry.status === "available" ? "available" : entry.status === "unavailable" ? "manually unavailable" : entry.past ? "past date" : "not confirmed"}`}
                              >
                                {entry.day}
                              </span>
                            ))}
                          </div>
                          <p className="public-model-calendar-note">Confirmed bookings take priority. {availability.availabilityManaged ? "Availability preferences are shown where this model has set them." : "Other dates are not confirmed because this model has not published managed availability."}</p>
                        </>
                      )}
                    </section>
                  )}
                </div>
              </div>
            </section>

            <Reviews recipientRole="model" recipientId={modelId} />

            <section className="public-model-portfolio" aria-labelledby="portfolio-heading">
              <div className="public-model-section-heading">
                <p>Selected work</p>
                <h2 id="portfolio-heading">Portfolio</h2>
              </div>

              {portfolioImages.length > 0 ? (
                <div className="public-model-gallery">
                  {portfolioImages.map((url, index) => (
                    <figure key={url}>
                      <img
                        src={url}
                        alt={`${model.fullName} portfolio ${index + 1}`}
                        onError={() => setFailedPortfolioImages((current) => [...current, url])}
                      />
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="public-model-empty-portfolio">No portfolio images added yet.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
