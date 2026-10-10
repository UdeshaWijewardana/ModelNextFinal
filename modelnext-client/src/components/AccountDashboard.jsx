import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, getCurrentUser, readJson } from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";

const fieldsByRole = {
  model: ["fullName", "username", "address", "phone", "birthdate", "location", "gender", "weight", "height", "waist", "hip"],
  photographer: ["name", "phone", "location", "portfolio"],
  agency: ["agencyName", "ownerName", "phone", "address", "businessId"],
};

const statusCopy = {
  pending: { title: "PENDING ADMIN APPROVAL", message: "Your registration has been submitted and is being reviewed by the ModelNext administration team. Profile editing will be enabled after approval." },
  approved: { title: "ACCOUNT APPROVED", message: "Your ModelNext account has been approved. You can now update your profile information." },
  rejected: { title: "REGISTRATION NOT APPROVED", message: "This registration was not approved. Profile editing is unavailable for this account." },
};

export default function AccountDashboard({ role, title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ user: current }, { notifications: items }] = await Promise.all([getCurrentUser(), readJson(await apiFetch("/notifications"))]);
      if (current.role !== role) throw new Error("This account cannot access this dashboard.");
      setUser(current); setForm(current); setNotifications(items);
    } catch (err) { setError(err.message); }
  }, [role]);
  useEffect(() => { load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    if (user.approvalStatus !== "approved") return;
    setSaving(true); setError("");
    try { const { user: updated } = await readJson(await apiFetch("/auth/me/profile", { method: "PATCH", body: JSON.stringify(form) })); setUser(updated); setForm(updated); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const markRead = async (id) => {
    try { await readJson(await apiFetch(`/notifications/${id}/read`, { method: "PATCH", body: "{}" })); setNotifications((items) => items.map((item) => item._id === id ? { ...item, read: true } : item)); }
    catch (err) { setError(err.message); }
  };
  const signOut = async () => { await logout(); navigate("/"); };
  if (!user) return <><Navbar /><main className="account-dashboard">{error || "Loading account..."}</main></>;
  const approvalStatus = user.approvalStatus || "pending";
  const status = statusCopy[approvalStatus] || statusCopy.pending;
  const editable = approvalStatus === "approved";
  return <><Navbar /><main className="account-dashboard">
    <h1>{title}</h1><p>{user.name} · {user.email}</p>
    {location.state?.registrationSubmitted && <section className="account-status-banner approved" role="status"><strong>REGISTRATION SUBMITTED SUCCESSFULLY</strong><p>Thank you for registering with ModelNext. Your account is pending administrator approval. You can review your account information while it is being reviewed.</p></section>}
    <section className={`account-status-banner ${approvalStatus}`} role="status"><strong>{status.title}</strong><p>{status.message}</p>{approvalStatus === "rejected" && user.rejectionReason && <p><strong>Reason:</strong> {user.rejectionReason}</p>}</section>
    {error && <p className="account-error" role="alert">{error}</p>}
    {editable && <button type="button" onClick={() => navigate("/event-chats")}>Event group chats &amp; invitations</button>}
    <form className={`account-profile-form ${editable ? "is-editable" : "is-locked"}`} onSubmit={save}>
      {!editable && <p className="account-lock-note">Your submitted account details are view-only until approval.</p>}
      {fieldsByRole[role].map((field) => <label key={field}>{field}<input disabled={!editable} value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} /></label>)}
      {editable && <button disabled={saving} type="submit">{saving ? "Saving..." : "Save profile"}</button>}
    </form>
    <h2>Notifications</h2>{notifications.length === 0 ? <p>No notifications.</p> : notifications.map((item) => <p key={item._id}><button disabled={item.read} onClick={() => markRead(item._id)}>{item.read ? "Read" : "Mark read"}</button> {item.message}</p>)}
    <button onClick={signOut}>Logout</button>
  </main></>;
}
