import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, readJson } from "../api";

export default function AIModelRecommendations() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadMatches = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await readJson(
          await apiFetch(`/matching/events/${eventId}/models`)
        );

        setEvent(data.event || null);
        setMatches(data.matches || []);
      } catch (err) {
        setError(
          err.message || "Failed to load AI recommendations."
        );
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, [eventId]);

  const getImageUrl = (profileImage) => {
    if (!profileImage) {
      return "";
    }

    if (profileImage.startsWith("http")) {
      return profileImage;
    }

    return `http://localhost:5000/${profileImage.replace(
      /\\/g,
      "/"
    )}`;
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingOrb}>AI</div>

          <h2 style={styles.loadingTitle}>
            Finding the best models
          </h2>

          <p style={styles.loadingText}>
            Our AI is analysing model compatibility for this event.
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

        {/* TOP NAVIGATION */}
        <div style={styles.topBar}>
          <button
            type="button"
            style={styles.backButton}
            onClick={() => navigate("/client-portal")}
          >
            ← Back to Client Portal
          </button>
        </div>

        {/* PAGE HEADER */}
        <header style={styles.header}>
          <div style={styles.aiBadge}>
            AI
          </div>

          <div>
            <p style={styles.eyebrow}>
              MODELNEXT AI
            </p>

            <h1 style={styles.title}>
              Recommended Models
            </h1>

            <p style={styles.subtitle}>
              AI-powered recommendations based on your event
              requirements.
            </p>
          </div>
        </header>

        {/* EVENT SUMMARY */}
        {event && (
          <section style={styles.eventCard}>
            <div style={styles.eventInfo}>
              <p style={styles.eventLabel}>
                EVENT
              </p>

              <h2 style={styles.eventTitle}>
                {event.title}
              </h2>

              <p style={styles.eventMeta}>
                {event.eventType || "Event"}
                {event.location
                  ? ` • ${event.location}`
                  : ""}
              </p>
            </div>

            <div style={styles.resultCount}>
              <strong style={styles.resultNumber}>
                {matches.length}
              </strong>

              <span style={styles.resultLabel}>
                Recommended
              </span>
            </div>
          </section>
        )}

        {/* RESULTS */}
        {matches.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              AI
            </div>

            <h2 style={styles.emptyTitle}>
              No suitable models found
            </h2>

            <p style={styles.emptyText}>
              No approved models currently match the
              requirements for this event.
            </p>
          </div>
        ) : (
          <section style={styles.resultsSection}>

            {/* SECTION HEADER */}
            <div style={styles.sectionHeading}>
              <div>
                <p style={styles.eyebrow}>
                  AI MATCHING
                </p>

                <h2 style={styles.sectionTitle}>
                  Top Model Recommendations
                </h2>
              </div>

              <p style={styles.sectionDescription}>
                Ranked by AI compatibility score
              </p>
            </div>

            {/* MODEL GRID */}
            <div style={styles.grid}>
              {matches.map((match, index) => {
                const imageUrl = getImageUrl(
                  match.profileImage
                );

                return (
                  <article
                    key={match.id || index}
                    style={styles.modelCard}
                  >

                    {/* MODEL IMAGE */}
                    <div style={styles.imageWrapper}>

                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={match.fullName}
                          style={styles.profileImage}
                          onError={(event) => {
                            event.currentTarget.style.display =
                              "none";

                            if (
                              event.currentTarget
                                .nextSibling
                            ) {
                              event.currentTarget.nextSibling.style.display =
                                "flex";
                            }
                          }}
                        />
                      ) : null}

                      {/* FALLBACK IMAGE */}
                      <div
                        style={{
                          ...styles.imagePlaceholder,
                          display: imageUrl
                            ? "none"
                            : "flex",
                        }}
                      >
                        <span>
                          {match.fullName
                            ?.charAt(0)
                            ?.toUpperCase() || "M"}
                        </span>
                      </div>

                      {/* IMAGE OVERLAY */}
                      <div style={styles.imageOverlay} />

                      {/* RANK */}
                      <div style={styles.rankBadge}>
                        #{index + 1}
                      </div>

                      {/* MATCH SCORE */}
                      <div style={styles.scoreBadge}>
                        <span style={styles.scoreValue}>
                          {match.matchScore}%
                        </span>

                        <span style={styles.scoreLabel}>
                          MATCH
                        </span>
                      </div>
                    </div>

                    {/* MODEL INFORMATION */}
                    <div style={styles.cardContent}>

                      {/* NAME + AI MATCH */}
                      <div style={styles.nameRow}>
                        <div>
                          <h3 style={styles.modelName}>
                            {match.fullName}
                          </h3>

                          <p style={styles.recommendation}>
                            {match.recommendation}
                          </p>
                        </div>

                        {match.compatible && (
                          <div
                            style={
                              styles.compatibleBadge
                            }
                          >
                            AI MATCH
                          </div>
                        )}
                      </div>

                      {/* MODEL DETAILS */}
                      <div style={styles.details}>

                        {match.location && (
                          <div style={styles.detailRow}>
                            <span
                              style={
                                styles.detailLabel
                              }
                            >
                              Location
                            </span>

                            <span>
                              {match.location}
                            </span>
                          </div>
                        )}

                        {match.gender && (
                          <div style={styles.detailRow}>
                            <span
                              style={
                                styles.detailLabel
                              }
                            >
                              Gender
                            </span>

                            <span>
                              {match.gender}
                            </span>
                          </div>
                        )}

                        {match.height && (
                          <div style={styles.detailRow}>
                            <span
                              style={
                                styles.detailLabel
                              }
                            >
                              Height
                            </span>

                            <span>
                              {match.height} cm
                            </span>
                          </div>
                        )}
                      </div>

                      {/* CATEGORIES */}
                      {match.categories?.length > 0 && (
                    <div style={styles.categories}>
                        {match.categories.map(
                        (category, categoryIndex) => (
                            <span
                            key={`category-${categoryIndex}`}
                            style={styles.category}
                            >
                            {category}
                            </span>
                        )
                        )}
                    </div>
                    )}

                    {match.skills?.length > 0 && (
                    <div style={styles.categories}>
                        {match.skills.map(
                        (skill, skillIndex) => (
                            <span
                            key={`skill-${skillIndex}`}
                            style={styles.category}
                            >
                            {skill}
                            </span>
                        )
                        )}
                    </div>
                    )}

                      {/* VIEW PROFILE */}
                      <button
                    type="button"
                    style={styles.profileButton}
                    onClick={() => {
                        const imageUrl = getImageUrl(
                        match.profileImage
                        );

                        const params = new URLSearchParams({
                        name: match.fullName || "Model",
                        role: "Fashion Model",
                        img: imageUrl,
                        location: match.location || "Sri Lanka",
                        });

                        navigate(`/profile?${params.toString()}`);
                    }}
                    >
                    <span>
                        View Model Profile
                    </span>

                    <span style={styles.arrow}>
                        →
                    </span>
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
    transition: "all 0.2s ease",
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
    gap: "20px",
    background: "var(--mn-surface)",
    border: "1px solid var(--mn-border)",
    borderRadius: "16px",
    padding: "23px",
    marginBottom: "40px",
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
    minWidth: "112px",
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

  resultsSection: {
    width: "100%",
  },

  sectionHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
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
    gridTemplateColumns:
      "repeat(auto-fit, minmax(330px, 1fr))",
    gap: "22px",
  },

  modelCard: {
    overflow: "hidden",
    background: "var(--mn-surface)",
    border: "1px solid var(--mn-border)",
    borderRadius: "18px",
    boxShadow:
      "0 12px 35px rgba(0, 0, 0, 0.25)",
  },

  /*
   * The image area is taller and uses contain so the
   * model photograph is not aggressively cropped.
   */
  imageWrapper: {
    position: "relative",
    height: "430px",
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
    boxShadow:
      "0 4px 18px rgba(0,0,0,0.3)",
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
    margin: "7px 0",
    color: "var(--mn-silver)",
    fontSize: "12px",
  },

  detailLabel: {
    width: "80px",
    color: "var(--mn-muted)",
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
