import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [eventRequests, setEventRequests] = useState([]);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    // Load pending events
    const er = JSON.parse(localStorage.getItem("pendingEvents")) || [];
    setEventRequests(er);
  }, [updateTrigger]);

  const handleApproveEvent = (event) => {
    // Remove from pending
    const pending = JSON.parse(localStorage.getItem("pendingEvents")) || [];
    const updatedPending = pending.filter(e => e._id !== event._id);
    localStorage.setItem("pendingEvents", JSON.stringify(updatedPending));

    // Add to approved
    const approved = JSON.parse(localStorage.getItem("approvedEvents")) || [];
    event.status = "APPROVED";
    localStorage.setItem("approvedEvents", JSON.stringify([event, ...approved]));

    alert(`Approved event "${event.title}"!`);
    setUpdateTrigger(prev => prev + 1);
  };

  const handleRejectEvent = (event) => {
    // Remove from pending
    const pending = JSON.parse(localStorage.getItem("pendingEvents")) || [];
    const updatedPending = pending.filter(e => e._id !== event._id);
    localStorage.setItem("pendingEvents", JSON.stringify(updatedPending));

    alert(`Rejected event "${event.title}".`);
    setUpdateTrigger(prev => prev + 1);
  };

  return (
    <div className="admin-page">
      <Navbar />

      <div className="admin-hero">
        <div className="admin-hero-content">
          <h1>Admin <span className="gold-text">Moderation Dashboard</span></h1>
          <p>Review and approve system-wide events from the ModelNext network.</p>
        </div>
      </div>

      <div className="admin-container">
        {/* EVENT REQUESTS */}
        <div className="admin-panel-card">
          <h2>Event Creation Requests</h2>
          <p className="panel-desc">Review and approve events before they are published live on the public events grid.</p>

          {eventRequests.length === 0 ? (
            <div className="empty-state">No pending event creation requests.</div>
          ) : (
            <div className="admin-events-list">
              {eventRequests.map((event) => (
                <div key={event._id} className="admin-event-request-card">
                  <img src={event.image} alt={event.title} className="req-event-img" />
                  <div className="req-event-details">
                    <div className="req-event-meta">
                      <span className="req-event-date">📅 {event.date}</span>
                      <span className="req-event-host">Host: {event.clientName} ({event.organizerRole})</span>
                    </div>
                    <h3>{event.title}</h3>
                    <p className="req-event-loc">📍 {event.location}</p>
                    <p className="req-event-desc">{event.description}</p>
                    <div className="req-event-actions">
                      <button className="approve-btn" onClick={() => handleApproveEvent(event)}>Approve &amp; Publish</button>
                      <button className="reject-btn" onClick={() => handleRejectEvent(event)}>Reject Request</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
