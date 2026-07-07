import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("verification");
  const [verRequests, setVerRequests] = useState([]);
  const [eventRequests, setEventRequests] = useState([]);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    // Load verification requests
    const vr = JSON.parse(localStorage.getItem("verificationRequests")) || [];
    setVerRequests(vr);

    // Load pending events
    const er = JSON.parse(localStorage.getItem("pendingEvents")) || [];
    setEventRequests(er);
  }, [updateTrigger]);

  const handleApproveVerification = (request) => {
    // Update request status
    const allRequests = JSON.parse(localStorage.getItem("verificationRequests")) || [];
    const updatedRequests = allRequests.filter(r => r.id !== request.id);
    localStorage.setItem("verificationRequests", JSON.stringify(updatedRequests));

    // Update verified status in specific profile storage
    if (request.role === "model") {
      const data = JSON.parse(localStorage.getItem("modelData"));
      if (data) {
        data.verified = true;
        localStorage.setItem("modelData", JSON.stringify(data));
      }
    } else if (request.role === "agency") {
      const data = JSON.parse(localStorage.getItem("agencyData"));
      if (data) {
        data.verified = true;
        localStorage.setItem("agencyData", JSON.stringify(data));
      }
    } else if (request.role === "photographer") {
      const data = JSON.parse(localStorage.getItem("photographerData"));
      if (data) {
        data.verified = true;
        localStorage.setItem("photographerData", JSON.stringify(data));
      }
    }

    // Also update currentUser if it matches
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (currentUser && currentUser.email === request.email) {
      currentUser.verified = true;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    }

    alert(`Approved verification for ${request.name}!`);
    setUpdateTrigger(prev => prev + 1);
  };

  const handleRejectVerification = (request) => {
    const allRequests = JSON.parse(localStorage.getItem("verificationRequests")) || [];
    const updatedRequests = allRequests.filter(r => r.id !== request.id);
    localStorage.setItem("verificationRequests", JSON.stringify(updatedRequests));

    alert(`Rejected verification request for ${request.name}.`);
    setUpdateTrigger(prev => prev + 1);
  };

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
          <p>Review, verify, and approve system-wide events and credentials from the ModelNext network.</p>
        </div>
      </div>

      <div className="admin-container">
        {/* TABS */}
        <div className="admin-tabs">
          <button 
            className={`admin-tab-btn ${activeTab === "verification" ? "active" : ""}`}
            onClick={() => setActiveTab("verification")}
          >
            Verification Requests ({verRequests.filter(r => r.status === 'PENDING').length})
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === "events" ? "active" : ""}`}
            onClick={() => setActiveTab("events")}
          >
            Event Creation Requests ({eventRequests.length})
          </button>
        </div>

        {/* TAB 1: VERIFICATION REQUESTS */}
        {activeTab === "verification" && (
          <div className="admin-panel-card">
            <h2>Verification Badge Requests</h2>
            <p className="panel-desc">Approve or deny applications for the golden verification checkmark.</p>

            {verRequests.length === 0 ? (
              <div className="empty-state">No pending verification requests.</div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Location</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verRequests.map((req) => (
                      <tr key={req.id}>
                        <td className="bold-cell">{req.name}</td>
                        <td>{req.email}</td>
                        <td><span className={`role-badge ${req.role}`}>{req.role}</span></td>
                        <td>{req.location}</td>
                        <td>
                          <div className="table-actions">
                            <button className="approve-btn" onClick={() => handleApproveVerification(req)}>Approve</button>
                            <button className="reject-btn" onClick={() => handleRejectVerification(req)}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EVENT REQUESTS */}
        {activeTab === "events" && (
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
                        <button className="approve-btn" onClick={() => handleApproveEvent(event)}>Approve & Publish</button>
                        <button className="reject-btn" onClick={() => handleRejectEvent(event)}>Reject Request</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
