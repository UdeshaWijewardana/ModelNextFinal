import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  apiFetch,
  readJson,
  SERVER_BASE_URL,
} from "../api";
import { loadReviewSummaries, RatingSummary } from "../components/reviews/Reviews";
import "../styles/Models.css";

export default function Models() {
  const navigate = useNavigate();

  const [models, setModels] = useState([]);
  const [reviewSummaries, setReviewSummaries] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/models")
      .then(readJson)
      .then(async ({ models: items }) => {
        setModels(items);
        setReviewSummaries(await loadReviewSummaries("model", items.map(item => item._id)));
      })
      .catch((err) =>
        setError(err.message)
      );
  }, []);

  return (
    <div className="models-page">
      <Navbar />

      <main className="models-container">
        <h1>Fashion Models</h1>

        {error && <p>{error}</p>}

        <div className="models-grid">
          {models.map((model) => {
            const profileImage = model.profileImage
              ? `${SERVER_BASE_URL}/${model.profileImage.replace(
                  /^[/\\]+/,
                  ""
                )}`
              : "";

            return (
              <article
                className="model-card"
                key={model._id}
              >
                <div className="model-img-wrapper">
                  {profileImage ? (
                    <img
                      className="model-img"
                      src={profileImage}
                      alt={model.fullName}
                    />
                  ) : (
                    <span
                      className="model-image-placeholder"
                      aria-hidden="true"
                    >
                      {model.fullName?.charAt(0) ||
                        "M"}
                    </span>
                  )}
                </div>

                <div className="model-details">
                  <h3 className="model-name">
                    {model.fullName}
                  </h3>

                  <p className="model-agency">
                    {model.categories?.join(
                      ", "
                    ) || "Fashion model"}
                  </p>

                  {reviewSummaries[model._id] && <RatingSummary summary={reviewSummaries[model._id]} />}

                  <p className="stat-row">
                    <span className="stat-label">
                      Location
                    </span>

                    <span className="stat-val">
                      {model.location ||
                        "Not listed"}
                    </span>
                  </p>

                  <button
                    type="button"
                    className="model-view-btn"
                    onClick={() =>
                      navigate(`/models/${model._id}`)
                    }
                  >
                    View profile
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {!error && models.length === 0 && (
          <p>
            No approved models are listed yet.
          </p>
        )}
      </main>
    </div>
  );
}
