import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, readJson } from "../api";
import "../styles/AdminRegister.css";

export default function AdminRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleFields, setVisibleFields] = useState({ password: false, confirmPassword: false });

  const handleInputChange = (event) => setFormData({ ...formData, [event.target.name]: event.target.value });
  const toggleVisibility = (field) => setVisibleFields((current) => ({ ...current, [field]: !current[field] }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const { name, email, password, confirmPassword } = formData;

    if (!name || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiFetch("/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      await readJson(response);
      setSuccess(true);
      setTimeout(() => navigate("/admin"), 1200);
    } catch (err) {
      const isNetworkFailure = err instanceof TypeError && /fetch/i.test(err.message);
      setError(isNetworkFailure ? "Cannot connect to the server. Start the ModelNext backend on port 5000 and try again." : (err.message || "Unable to create administrator account."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordField = (name, label) => (
    <label className="admin-register-field" htmlFor={`admin-${name}`}>
      <span>{label}</span>
      <div className="admin-register-password-wrap">
        <input
          id={`admin-${name}`}
          name={name}
          type={visibleFields[name] ? "text" : "password"}
          value={formData[name]}
          onChange={handleInputChange}
          required
          autoComplete="new-password"
        />
        <button
          type="button"
          className="admin-register-visibility"
          onClick={() => toggleVisibility(name)}
          aria-label={`${visibleFields[name] ? "Hide" : "Show"} ${label.toLowerCase()}`}
        >
          {visibleFields[name] ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );

  return (
    <main className="admin-register-page">
      <section className="admin-register-panel">
        <div className="admin-register-topbar">
          <button type="button" className="admin-register-brand" onClick={() => navigate("/")}>ModelNext</button>
          <button type="button" className="admin-register-back" onClick={() => navigate("/")}>← Back to Home</button>
        </div>

        <div className="admin-register-content">
          <p className="admin-register-eyebrow">Admin portal</p>
          <h1>Create Administrator Account</h1>
          <p className="admin-register-intro">Create a secure moderation account for managing the ModelNext platform.</p>

          {success ? (
            <section className="admin-register-success" role="status">
              <p className="admin-register-eyebrow">Account created</p>
              <h2>Administrator account is ready.</h2>
              <p>Redirecting you to the admin dashboard…</p>
            </section>
          ) : (
            <form className="admin-register-form" onSubmit={handleSubmit}>
              {error && <p className="admin-register-error" role="alert">{error}</p>}
              <label className="admin-register-field" htmlFor="admin-name">
                <span>Full Name</span>
                <input id="admin-name" name="name" value={formData.name} onChange={handleInputChange} required autoComplete="name" />
              </label>
              <label className="admin-register-field" htmlFor="admin-email">
                <span>Email Address</span>
                <input id="admin-email" name="email" type="email" value={formData.email} onChange={handleInputChange} required autoComplete="email" />
              </label>
              <div className="admin-register-password-row">
                {passwordField("password", "Password")}
                {passwordField("confirmPassword", "Confirm Password")}
              </div>
              <button type="submit" className="admin-register-submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating account…" : "Create Admin Account"}
              </button>
            </form>
          )}

          <p className="admin-register-login-copy">
            Already have an account? <button type="button" onClick={() => navigate("/login")}>Log In</button>
          </p>
        </div>
      </section>

      <aside className="admin-register-visual" aria-label="ModelNext secure platform management">
        <img src="/assets/admin-portal-editorial.png" alt="Editorial portrait for the ModelNext administrator portal" />
        <div className="admin-register-visual-overlay" />
        <div className="admin-register-visual-copy">
          <p>Secure platform</p>
          <h2>Management</h2>
          <span aria-hidden="true" />
          <small>Review registrations.<br />Manage approvals.<br />Protect the community.</small>
        </div>
      </aside>
    </main>
  );
}
