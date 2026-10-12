
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, readJson } from "../api";

export default function AIModelRecommendations() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [matches, setMatches] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [activeTab, setActiveTab] = useState("models");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadMatches = async () => {
      try {
        setLoading(true);
        setError("");

        const [modelData, photographerData] = await Promise.all([
          apiFetch(`/matching/events/${eventId}/models`)
            .then(readJson),

          apiFetch(`/matching/events/${eventId}/photographers`)
            .then(readJson),
        ]);

        if (cancelled) return;

        setEvent(modelData.event || photographerData.event || null);
        setMatches(modelData.matches || []);
        setPhotographers(photographerData.matches || []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Failed to load talent recommendations."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (eventId) {
      loadMatches();
    } else {
      setError("No event was selected.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const getImageUrl = (profileImage) => {
    if (!profileImage) return "";

    if (/^https?:\/\//i.test(profileImage)) {
      return profileImage;
    }

    const normalizedPath = profileImage.replace(/\\/g, "/");
    const baseUrl = (
      process.env.REACT_APP_API_BASE_URL || "http://localhost:5000/api"
    ).replace(/\/api\/?$/, "");

    return `${baseUrl}/${normalizedPath.replace(/^\/+/, "")}`;
  };

  const activeMatches =
    activeTab === "models" ? matches : photographers;

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingOrb}>AI</div>
          <h2 style={styles.loadingTitle}>
            Finding the best talent
          </h2>
          <p style={styles.loadingText}>
            Analysing profiles for your selected event.
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.page}>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>!</div>
          <h2>Unable to load recommendations</h2>
          <p>{error}</p>
          <button
            type="button"
            style={styles.backButton}
            onClick={() => navigate("/client-portal")}
          >
            ← Back to Client Portal
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <button
            type="button"
            style={styles.backButton}
            onClick={() => navigate("/client-portal")}
          >
            ← Back to Client Portal
          </button>
        </div>

        <header style={styles.header}>
          <div style={styles.aiBadge}>AI</div>
          <div>
            <p style={styles.eyebrow}>MODELNEXT MATCHING</p>
            <h1 style={styles.title}>Recommended Talent</h1>
            <p style={styles.subtitle}>
              Discover models and photographers for your event.
            </p>
          </div>
        </header>

        {event && (
          <section style={styles.eventCard}>
            <div style={styles.eventInfo}>
              <p style={styles.eventLabel}>SELECTED EVENT</p>
              <h2 style={styles.eventTitle}>{event.title}</h2>
              <p style={styles.eventMeta}>
                {event.eventType || "Event"}
                {event.location ? ` • ${event.location}` : ""}
              </p>
            </div>

            <div style={styles.resultCount}>
              <strong style={styles.resultNumber}>
                {matches.length + photographers.length}
              </strong>
              <span style={styles.resultLabel}>
                Total recommendations
              </span>
            </div>
          </section>
        )}

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => setActiveTab("models")}
            style={{
              ...styles.tabButton,
              ...(activeTab === "models" ? styles.activeTabButton : {}),
            }}
          >
            Models ({matches.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("photographers")}
            style={{
              ...styles.tabButton,
              ...(activeTab === "photographers"
                ? styles.activeTabButton
                : {}),
            }}
          >
            Photographers ({photographers.length})
          </button>
        </div>

        {activeMatches.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>AI</div>
            <h2 style={styles.emptyTitle}>
              No {activeTab} found
            </h2>
            <p style={styles.emptyText}>
              There are currently no approved {activeTab} to recommend
              for this event.
            </p>
          </div>
        ) : (
          <section style={styles.resultsSection}>
            <div style={styles.sectionHeading}>
              <div>
                <p style={styles.eyebrow}>
                  {activeTab === "models"
                    ? "AI MATCHING"
                    : "PHOTOGRAPHER MATCHING"}
                </p>
                <h2 style={styles.sectionTitle}>
                  {activeTab === "models"
                    ? "Top Model Recommendations"
                    : "Top Photographer Recommendations"}
                </h2>
              </div>

              <p style={styles.sectionDescription}>
                {activeTab === "models"
                  ? "Ranked by event compatibility"
                  : "Ranked using available profile information"}
              </p>
            </div>

            <div style={styles.grid}>
              {activeMatches.map((match, index) => {
                const isPhotographer = activeTab === "photographers";
                const imageUrl = getImageUrl(match.profileImage);
                const name = match.fullName || "Unnamed talent";

                const params = new URLSearchParams({
                  eventId: event?.id || eventId || "",
                  eventTitle: event?.title || "Selected Event",
                  eventType: event?.eventType || "Event",
                  eventLocation: event?.location || "",
                });

                const profilePath = isPhotographer
                  ? `/photographers/${match.id}`
                  : `/models/${match.id}`;

                return (
                  <article
                    key={match.id || index}
                    style={styles.modelCard}
                  >
                    <div style={styles.imageWrapper}>
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={name}
                          style={styles.profileImage}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback =
                              e.currentTarget.parentElement?.querySelector(
                                ".profile-fallback"
                              );
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      )}

                      <div
                        className="profile-fallback"
                        style={{
                          ...styles.imagePlaceholder,
                          display: imageUrl ? "none" : "flex",
                        }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>

                      <div style={styles.imageOverlay} />

                      <div style={styles.rankBadge}>
                        #{index + 1}
                      </div>

                      <div style={styles.scoreBadge}>
                        <span style={styles.scoreValue}>
                          {Number(match.matchScore ?? 0).toFixed(1)}%
                        </span>
                        <span style={styles.scoreLabel}>MATCH</span>
                      </div>
                    </div>

                    <div style={styles.cardContent}>
                      <div style={styles.nameRow}>
                        <div>
                          <h3 style={styles.modelName}>{name}</h3>
                          <p style={styles.recommendation}>
                            {match.recommendation ||
                              "Potential event match"}
                          </p>
                        </div>

                        {match.compatible && (
                          <div style={styles.compatibleBadge}>
                            {isPhotographer ? "GOOD FIT" : "AI MATCH"}
                          </div>
                        )}
                      </div>

                      <div style={styles.details}>
                        {match.location && (
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>
                              Location
                            </span>
                            <span>{match.location}</span>
                          </div>
                        )}

                        {!isPhotographer && match.gender && (
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>
                              Gender
                            </span>
                            <span>{match.gender}</span>
                          </div>
                        )}

                        {!isPhotographer && match.height && (
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>
                              Height
                            </span>
                            <span>{match.height} cm</span>
                          </div>
                        )}

                        {isPhotographer && (
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>
                              Experience
                            </span>
                            <span>
                              {match.experienceYears ?? 0} years
                            </span>
                          </div>
                        )}

                        {isPhotographer && (
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>
                              Portfolio
                            </span>
                            {match.portfolio ? (
                              <a
                                href={match.portfolio}
                                target="_blank"
                                rel="noreferrer"
                                style={styles.portfolioLink}
                              >
                                View Portfolio ↗
                              </a>
                            ) : (
                              <span>Not provided</span>
                            )}
                          </div>
                        )}
                      </div>

                      {!isPhotographer &&
                        match.categories?.length > 0 && (
                          <div style={styles.categories}>
                            {match.categories.map((category, i) => (
                              <span
                                key={`category-${i}`}
                                style={styles.category}
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        )}

                      {!isPhotographer &&
                        match.skills?.length > 0 && (
                          <div style={styles.categories}>
                            {match.skills.map((skill, i) => (
                              <span
                                key={`skill-${i}`}
                                style={styles.category}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                      <button
                        type="button"
                        style={styles.profileButton}
                        onClick={() =>
                          navigate(
                            `${profilePath}?${params.toString()}`
                          )
                        }
                      >
                        <span>
                          {isPhotographer
                            ? "View Photographer Profile"
                            : "View Model Profile"}
                        </span>
                        <span style={styles.arrow}>→</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #050505 0%, #101010 50%, #050505 100%)",
    color: "var(--mn-ivory)",
    padding: "32px 24px 60px",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  topBar: {
    marginBottom: "28px",
  },
  backButton: {
    background: "transparent",
    border: "1px solid var(--mn-border-strong)",
    color: "var(--mn-ivory)",
    padding: "10px 17px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    marginBottom: "34px",
  },
  aiBadge: {
    width: "58px",
    height: "58px",
    minWidth: "58px",
    borderRadius: "16px",
    background: "var(--mn-burgundy)",
    color: "var(--mn-ivory)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
    fontWeight: "800",
  },
  eyebrow: {
    margin: "0 0 6px",
    color: "var(--mn-burgundy)",
    fontSize: "10px",
    letterSpacing: "2px",
    fontWeight: "700",
  },
  title: {
    margin: 0,
    fontSize: "36px",
    lineHeight: 1.15,
    fontWeight: "700",
  },
  subtitle: {
    margin: "9px 0 0",
    color: "var(--mn-silver)",
    fontSize: "14px",
  },
  eventCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "20px",
    background: "var(--mn-surface)",
    border: "1px solid var(--mn-border)",
    borderRadius: "16px",
    padding: "23px",
    marginBottom: "28px",
  },
  eventInfo: {
    minWidth: 0,
  },
  eventLabel: {
    margin: "0 0 6px",
    color: "var(--mn-burgundy)",
    fontSize: "9px",
    letterSpacing: "2px",
    fontWeight: "700",
  },
  eventTitle: {
    margin: 0,
    fontSize: "23px",
    fontWeight: "500",
  },
  eventMeta: {
    margin: "8px 0 0",
    color: "var(--mn-muted)",
    fontSize: "13px",
  },
  resultCount: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "130px",
    padding: "12px 16px",
    borderRadius: "12px",
    background: "var(--mn-surface-raised)",
  },
  resultNumber: {
    fontSize: "22px",
    lineHeight: 1,
    fontWeight: "800",
    color: "var(--mn-ivory)",
  },
  resultLabel: {
    marginTop: "6px",
    color: "var(--mn-muted)",
    fontSize: "10px",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "30px",
  },
  tabButton: {
    background: "var(--mn-surface)",
    border: "1px solid var(--mn-border-strong)",
    color: "var(--mn-ivory)",
    padding: "12px 20px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
  activeTabButton: {
    background: "var(--mn-burgundy)",
    borderColor: "var(--mn-burgundy)",
    color: "var(--mn-ivory)",
  },
  resultsSection: {
    width: "100%",
  },
  sectionHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    flexWrap: "wrap",
    gap: "20px",
    marginBottom: "20px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "23px",
    fontWeight: "500",
  },
  sectionDescription: {
    margin: 0,
    color: "var(--mn-muted)",
    fontSize: "12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "22px",
  },
  modelCard: {
    overflow: "hidden",
    background: "var(--mn-surface)",
    border: "1px solid var(--mn-border)",
    borderRadius: "18px",
    boxShadow: "0 12px 35px rgba(0, 0, 0, 0.25)",
  },
  imageWrapper: {
    position: "relative",
    height: "380px",
    overflow: "hidden",
    background: "var(--mn-surface-raised)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center center",
    display: "block",
    background: "var(--mn-surface-raised)",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, var(--mn-surface-raised), var(--mn-border))",
    color: "var(--mn-burgundy)",
    fontSize: "70px",
    fontWeight: "700",
  },
  imageOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(to bottom, rgba(0,0,0,0.12), transparent 55%, rgba(0,0,0,0.42))",
    pointerEvents: "none",
  },
  rankBadge: {
    position: "absolute",
    top: "14px",
    left: "14px",
    zIndex: 2,
    padding: "7px 10px",
    borderRadius: "8px",
    background: "rgba(0, 0, 0, 0.78)",
    border: "1px solid var(--mn-border-strong)",
    color: "var(--mn-ivory)",
    fontSize: "11px",
    fontWeight: "700",
  },
  scoreBadge: {
    position: "absolute",
    right: "14px",
    bottom: "14px",
    zIndex: 2,
    width: "68px",
    height: "68px",
    borderRadius: "50%",
    background: "var(--mn-burgundy)",
    color: "var(--mn-ivory)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 18px rgba(0,0,0,0.3)",
  },
  scoreValue: {
    fontSize: "15px",
    lineHeight: 1,
    fontWeight: "800",
  },
  scoreLabel: {
    marginTop: "4px",
    fontSize: "7px",
    letterSpacing: "1px",
    fontWeight: "700",
  },
  cardContent: {
    padding: "20px",
  },
  nameRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  modelName: {
    margin: 0,
    fontSize: "21px",
    fontWeight: "500",
  },
  recommendation: {
    margin: "6px 0 0",
    color: "var(--mn-burgundy)",
    fontSize: "12px",
    fontWeight: "600",
  },
  compatibleBadge: {
    flexShrink: 0,
    border: "1px solid var(--mn-burgundy)",
    color: "var(--mn-burgundy)",
    borderRadius: "20px",
    padding: "5px 9px",
    fontSize: "8px",
    letterSpacing: "1px",
    fontWeight: "700",
  },
  details: {
    marginTop: "20px",
    borderTop: "1px solid var(--mn-border)",
    borderBottom: "1px solid var(--mn-border)",
    padding: "12px 0",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    margin: "7px 0",
    color: "var(--mn-silver)",
    fontSize: "12px",
  },
  detailLabel: {
    flexShrink: 0,
    width: "80px",
    color: "var(--mn-muted)",
  },
  portfolioLink: {
    color: "var(--mn-burgundy)",
    textDecoration: "none",
  },
  categories: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    margin: "15px 0 18px",
  },
  category: {
    padding: "5px 10px",
    borderRadius: "20px",
    background: "var(--mn-surface-raised)",
    border: "1px solid var(--mn-border)",
    color: "var(--mn-silver)",
    fontSize: "10px",
  },
  profileButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 15px",
    border: "none",
    borderRadius: "9px",
    background: "var(--mn-burgundy)",
    color: "var(--mn-ivory)",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
  },
  arrow: {
    fontSize: "18px",
  },
  loadingContainer: {
    maxWidth: "600px",
    margin: "170px auto",
    textAlign: "center",
  },
  loadingOrb: {
    width: "62px",
    height: "62px",
    margin: "0 auto 20px",
    borderRadius: "18px",
    background: "var(--mn-burgundy)",
    color: "var(--mn-ivory)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
  },
  loadingTitle: {
    margin: 0,
    fontSize: "25px",
  },
  loadingText: {
    marginTop: "10px",
    color: "var(--mn-muted)",
    fontSize: "14px",
  },
  errorContainer: {
    maxWidth: "600px",
    margin: "120px auto",
    textAlign: "center",
  },
  errorIcon: {
    width: "50px",
    height: "50px",
    margin: "0 auto 18px",
    borderRadius: "50%",
    background: "var(--mn-burgundy)",
    color: "var(--mn-ivory)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
  },
  emptyState: {
    textAlign: "center",
    padding: "80px 20px",
    background: "var(--mn-surface)",
    border: "1px solid var(--mn-border)",
    borderRadius: "16px",
  },
  emptyIcon: {
    width: "52px",
    height: "52px",
    margin: "0 auto 18px",
    borderRadius: "15px",
    background: "var(--mn-burgundy)",
    color: "var(--mn-ivory)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
  },
  emptyTitle: {
    margin: 0,
    fontSize: "22px",
  },
  emptyText: {
    marginTop: "10px",
    color: "var(--mn-muted)",
    fontSize: "14px",
  },
};
