import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getCurrentUser, logout, readJson } from "../api";

export default function ClientDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");

  // AI matching requirements
  const [requiredGender, setRequiredGender] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [minHeight, setMinHeight] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [requiredCategories, setRequiredCategories] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");

  // AI matching results
  const [matches, setMatches] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [matchingLoading, setMatchingLoading] = useState(false);

  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [{ user: current }, mine] = await Promise.all([
        getCurrentUser(),
        readJson(await apiFetch("/events/mine"))
      ]);

      if (current.role !== "client") {
        throw new Error("This account cannot access the client portal.");
      }

      setUser(current);
      setEvents(mine.events);
      setRequests(mine.requests);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();

    try {
      await readJson(
        await apiFetch("/events", {
          method: "POST",
          body: JSON.stringify({
            title,
            eventType: "Event",
            startDate,
            location: "To be confirmed",
            description: title,

            // AI matching requirements
            requiredGender: requiredGender || undefined,

            minAge:
              minAge !== ""
                ? Number(minAge)
                : undefined,

            maxAge:
              maxAge !== ""
                ? Number(maxAge)
                : undefined,

            minHeight:
              minHeight !== ""
                ? Number(minHeight)
                : undefined,

            maxHeight:
              maxHeight !== ""
                ? Number(maxHeight)
                : undefined,

            requiredCategories:
              requiredCategories
                ? requiredCategories
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : [],

            requiredSkills:
              requiredSkills
                ? requiredSkills
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : []
          })
        })
      );

      setTitle("");
      setStartDate("");

      setRequiredGender("");
      setMinAge("");
      setMaxAge("");
      setMinHeight("");
      setMaxHeight("");
      setRequiredCategories("");
      setRequiredSkills("");

      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const findMatches = (eventId) => {
    navigate(`/client-portal/ai-matches/${eventId}`);
  };

  const review = async (id, status) => {
    try {
      await readJson(
        await apiFetch(`/events/requests/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        })
      );

      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await readJson(
        await apiFetch(`/events/${id}`, {
          method: "DELETE"
        })
      );

      if (selectedEvent === id) {
        setSelectedEvent(null);
        setMatches([]);
      }

      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user) {
    return (
      <main style={{ padding: 40 }}>
        {error || "Loading account..."}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 850, margin: "40px auto" }}>
      <h1>Client Portal</h1>

      <p>{user.name}</p>

      {error && (
        <p style={{ color: "#b00020" }}>
          {error}
        </p>
      )}

      <form onSubmit={create}>
        <input
          required
          placeholder="Event name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          required
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <h3>Model Requirements</h3>

        <select
          value={requiredGender}
          onChange={(e) => setRequiredGender(e.target.value)}
        >
          <option value="">Any gender</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
          <option value="Other">Other</option>
        </select>

        <br />
        <br />

        <input
          type="number"
          min="1"
          placeholder="Minimum age"
          value={minAge}
          onChange={(e) => setMinAge(e.target.value)}
        />

        <input
          type="number"
          min="1"
          placeholder="Maximum age"
          value={maxAge}
          onChange={(e) => setMaxAge(e.target.value)}
        />

        <br />
        <br />

        <input
          type="number"
          min="1"
          placeholder="Minimum height (cm)"
          value={minHeight}
          onChange={(e) => setMinHeight(e.target.value)}
        />

        <input
          type="number"
          min="1"
          placeholder="Maximum height (cm)"
          value={maxHeight}
          onChange={(e) => setMaxHeight(e.target.value)}
        />

        <br />
        <br />

        <input
          placeholder="Required categories (e.g. Fashion, Runway)"
          value={requiredCategories}
          onChange={(e) => setRequiredCategories(e.target.value)}
        />

        <input
          placeholder="Required skills (e.g. Runway, Photoshoot)"
          value={requiredSkills}
          onChange={(e) => setRequiredSkills(e.target.value)}
        />

        <br />
        <br />

        <button type="submit">
          Create event
        </button>
      </form>

      <h2>Participation requests</h2>

      {requests.map((request) => (
        <p key={request.id}>
          {request.requesterRole} requested {request.eventTitle}

          {" "}

          <button
            onClick={() =>
              review(request.id, "confirmed")
            }
          >
            Approve
          </button>

          <button
            onClick={() =>
              review(request.id, "declined")
            }
          >
            Decline
          </button>
        </p>
      ))}

      <h2>My events</h2>

      {events.map((event) => (
        <div
          key={event.id}
          style={{
            marginBottom: 20,
            padding: 15,
            border: "1px solid #555"
          }}
        >
          <p>
            <strong>{event.title}</strong> — {event.status}
          </p>

          <button
            onClick={() => findMatches(event.id)}
          >
            Find AI Model Matches
          </button>

          {" "}

          <button
            onClick={() => remove(event.id)}
          >
            Delete
          </button>

          {selectedEvent === event.id && (
            <div style={{ marginTop: 15 }}>
              <h3>AI Model Matches</h3>

              {matchingLoading && (
                <p>Finding suitable models...</p>
              )}

              {!matchingLoading && matches.length === 0 && (
                <p>
                  No approved models were found for this event.
                </p>
              )}

              {!matchingLoading &&
                matches.map((match, index) => (
                  <div
                    key={match.id || index}
                    style={{
                      padding: 10,
                      marginBottom: 10,
                      border: "1px solid #777"
                    }}
                  >
                    <strong>
                      #{index + 1} {match.fullName}
                    </strong>

                    <p>
                      Match Score:{" "}
                      <strong>
                        {match.matchScore}%
                      </strong>
                    </p>

                    <p>
                      Recommendation:{" "}
                      {match.recommendation}
                    </p>

                    {match.location && (
                      <p>
                        Location: {match.location}
                      </p>
                    )}

                    {match.categories?.length > 0 && (
                      <p>
                        Categories:{" "}
                        {match.categories.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={async () => {
          await logout();
          navigate("/login");
        }}
      >
        Logout
      </button>
    </main>
  );
}