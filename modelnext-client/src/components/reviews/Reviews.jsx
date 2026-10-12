import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, readJson } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "../../styles/Reviews.css";

export function RatingSummary({ summary }) {
  const count = summary?.reviewCount || 0;
  if (!count) return <span className="review-summary review-summary--empty">No reviews yet</span>;
  const average = Number(summary.averageRating || 0);
  const filled = Math.round(average);
  return <span className="review-summary" aria-label={`${average.toFixed(1)} out of 5 from ${count} reviews`}><span aria-hidden="true">{"★".repeat(filled)}{"☆".repeat(5 - filled)}</span> {average.toFixed(1)} ({count} {count === 1 ? "review" : "reviews"})</span>;
}

export const loadReviewSummaries = async (role, ids) => {
  if (!ids.length) return {};
  const data = await readJson(await apiFetch(`/reviews/summaries/${role}?ids=${ids.join(",")}`));
  return data.summaries || {};
};

export default function Reviews({ recipientRole, recipientId }) {
  const auth = useAuth();
  const authId = auth.account?.id || auth.account?._id;
  const isUser = auth.status === "authenticated" && auth.kind === "user";
  const isSelf = isUser && auth.role === recipientRole && String(authId) === String(recipientId);
  const [data, setData] = useState({ summary: { averageRating: 0, reviewCount: 0 }, reviews: [] });
  const [mine, setMine] = useState(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const publicData = await readJson(await apiFetch(`/reviews/${recipientRole}/${recipientId}`));
      setData(publicData);
      if (isUser && !isSelf) {
        const ownData = await readJson(await apiFetch(`/reviews/${recipientRole}/${recipientId}/mine`));
        setMine(ownData.review);
        setRating(ownData.review?.rating || 0);
        setReviewText(ownData.review?.reviewText || "");
      } else {
        setMine(null); setRating(0); setReviewText("");
      }
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [isSelf, isUser, recipientId, recipientRole]);

  useEffect(() => { load(); }, [load]);

  const submit = async event => {
    event.preventDefault();
    if (!rating || saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await readJson(await apiFetch(mine ? `/reviews/${mine.id}` : `/reviews/${recipientRole}/${recipientId}`, {
        method: mine ? "PUT" : "POST",
        body: JSON.stringify({ rating, reviewText }),
      }));
      setSuccess(mine ? "Review updated." : "Review submitted.");
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!mine || saving || !window.confirm("Delete your review?")) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await readJson(await apiFetch(`/reviews/${mine.id}`, { method: "DELETE" }));
      setMine(null); setRating(0); setReviewText(""); setSuccess("Review deleted.");
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  return <section className="reviews-panel" aria-labelledby={`reviews-${recipientRole}-${recipientId}`}>
    <div className="reviews-heading"><div><p>Community feedback</p><h2 id={`reviews-${recipientRole}-${recipientId}`}>Ratings &amp; Reviews</h2></div><RatingSummary summary={data.summary} /></div>
    {loading && <p className="reviews-state" role="status">Loading reviews…</p>}
    {error && <p className="reviews-state reviews-state--error" role="alert">{error}</p>}
    {success && <p className="reviews-state reviews-state--success" role="status">{success}</p>}

    {!loading && !isUser && auth.status !== "loading" && <p className="reviews-login"><Link to="/login">Login to Review</Link></p>}
    {!loading && isUser && !isSelf && <form className="review-form" onSubmit={submit}>
      <fieldset disabled={saving}><legend>{mine ? "Edit your review" : "Your rating"}</legend><div className="review-stars" role="radiogroup" aria-label="Rating from 1 to 5">{[1, 2, 3, 4, 5].map(value => <button type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} className={value <= rating ? "is-active" : ""} key={value} onClick={() => setRating(value)}>★</button>)}</div>
        <label>Written feedback <span>Optional</span><textarea maxLength="1000" value={reviewText} onChange={event => setReviewText(event.target.value)} /></label><small>{reviewText.length}/1000</small>
        <div className="review-form-actions"><button disabled={!rating || saving}>{saving ? "Saving…" : mine ? "Edit Review" : "Submit Review"}</button>{mine && <button type="button" className="is-delete" disabled={saving} onClick={remove}>Delete Review</button>}</div>
      </fieldset>
    </form>}

    {!loading && !data.reviews.length ? <p className="reviews-state">No reviews yet</p> : <div className="review-list">{data.reviews.map(review => <article key={review.id}><div><strong>{review.reviewerName}</strong><span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>{review.reviewText && <p>{review.reviewText}</p>}<time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time></article>)}</div>}
  </section>;
}
