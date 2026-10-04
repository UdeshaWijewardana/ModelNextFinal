import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/AdminDashboard.css";

const API_BASE_URL = "http://localhost:5000/api/admin";
const requestOptions = (options = {}) => ({ credentials: "include", headers: { "Content-Type": "application/json" }, ...options });

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ status: "checking", admin: null, error: "" });
  const [registrations, setRegistrations] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const loadRegistrations = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/registrations`, requestOptions());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load registration applications.");
    setRegistrations(data.registrations || []);
  }, []);

  useEffect(() => {
    const verifyAndLoad = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/me`, requestOptions());
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Administrator authentication failed.");
        setAuthState({ status: "authorized", admin: data.admin, error: "" });
        await loadRegistrations();
      } catch (error) {
        setAuthState({ status: "unauthorized", admin: null, error: error.message || "Administrator authentication failed." });
      }
    };

    verifyAndLoad();
  }, [loadRegistrations]);

  const updateRegistration = async (registration, decision) => {
    setUpdatingId(registration.id);
    setLoadError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/registrations/${registration.role}/${registration.id}/${decision}`,
        requestOptions({ method: "PATCH", body: JSON.stringify({}) })
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update registration application.");
      setRegistrations((current) => current.map((item) => item.id === data.registration.id ? data.registration : item));
    } catch (error) {
      setLoadError(error.message || "Unable to update registration application.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (authState.status === "checking") {
    return <div className="admin-page"><Navbar /><div className="admin-container"><div className="admin-panel-card">Verifying administrator session...</div></div></div>;
  }

  if (authState.status !== "authorized") {
    return (
      <div className="admin-page">
        <Navbar />
        <div className="admin-container"><div className="admin-panel-card">
          <h2>Administrator sign-in required</h2>
          <p className="panel-desc">{authState.error}</p>
          <button className="approve-btn" onClick={() => navigate("/login")}>Go to login</button>
        </div></div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <Navbar />
      <div className="admin-hero"><div className="admin-hero-content">
        <h1>Admin <span className="gold-text">Registration Review</span></h1>
        <p>Signed in as {authState.admin.name}. Registration data and approval status are loaded from the database.</p>
      </div></div>

      <div className="admin-container">
        <div className="admin-panel-card">
          <h2>Registration applications</h2>
          <p className="panel-desc">Review model, photographer, and agency applications. Approval changes are recorded by the server.</p>
          {loadError && <div className="empty-state">{loadError}</div>}
          {!loadError && registrations.length === 0 && <div className="empty-state">No registration applications were found.</div>}
          {registrations.length > 0 && (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
                <tbody>
                  {registrations.map((registration) => (
                    <tr key={`${registration.role}-${registration.id}`}>
                      <td className="bold-cell">{registration.name}</td>
                      <td>{registration.email}</td>
                      <td><span className={`role-badge ${registration.role}`}>{registration.role}</span></td>
                      <td>{registration.approvalStatus?.toUpperCase()}</td>
                      <td>{registration.createdAt ? new Date(registration.createdAt).toLocaleDateString() : "—"}</td>
                      <td><div className="table-actions">
                        <button className="approve-btn" disabled={registration.approvalStatus !== "pending" || updatingId === registration.id} onClick={() => updateRegistration(registration, "approve")}>Approve</button>
                        <button className="reject-btn" disabled={registration.approvalStatus !== "pending" || updatingId === registration.id} onClick={() => updateRegistration(registration, "reject")}>Reject</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
