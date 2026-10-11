import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, readJson } from "../api";
import RegistrationHeader from "../components/RegistrationHeader";
import "../styles/clientForm.css";

const initialForm = { type: "", name: "", username: "", phone: "", email: "", address: "", password: "", confirmPassword: "" };

export default function ClientForm() {
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault(); setError("");
    if (Object.values(form).some(value => !String(value).trim())) return setError("Complete every required field.");
    if (!["company", "individual"].includes(form.type)) return setError("Choose a valid client type.");
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(form.username)) return setError("Username must use 3–40 letters, numbers, dots, hyphens, or underscores.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Enter a valid email address.");
    if (!/^[+()\-\s0-9]{7,25}$/.test(form.phone)) return setError("Enter a valid contact number.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (inFlight.current) return;
    inFlight.current = true; setSubmitting(true);
    try {
      await readJson(await apiFetch("/clients/register", { method: "POST", body: JSON.stringify(form) }));
      navigate("/login", { state: { registrationSubmitted: true, registeredRole: "client" }, replace: true });
    } catch (caught) { setError(caught.message || "Unable to submit client registration."); }
    finally { inFlight.current = false; setSubmitting(false); }
  };
  return <main className="client-registration-page"><RegistrationHeader /><section className="client-registration-shell">
    <aside className="client-registration-intro"><p className="client-registration-kicker">MODELNEXT / CLIENT NETWORK</p><h1>Build the team behind your next idea.</h1><p>Connect with approved models, photographers, and agencies for professional creative work.</p><div className="client-registration-points"><span>Curated creative talent</span><span>Direct booking and private collaboration</span><span>One workspace for every project</span></div></aside>
    <section className="client-registration-card"><p className="client-registration-kicker">CLIENT REGISTRATION</p><h2>Create your account</h2><p className="client-registration-copy">Tell us who you are and how we can support your next production.</p>{error && <p className="client-form-error" role="alert">{error}</p>}
      <form onSubmit={submit} noValidate><div className="client-form-grid">
        <label>Client type<select name="type" value={form.type} onChange={update} required><option value="">Choose account type</option><option value="company">Company</option><option value="individual">Individual</option></select></label>
        <label>{form.type === "company" ? "Company name" : "Full name"}<input name="name" autoComplete="name" value={form.name} onChange={update} required /></label>
        <label>Username<input name="username" autoComplete="username" value={form.username} onChange={update} required /></label>
        <label>Phone number<input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} required /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required /></label>
        <label>Address or location<input name="address" autoComplete="street-address" value={form.address} onChange={update} required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" value={form.password} onChange={update} required /></label>
        <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update} required /></label>
      </div><button className="client-registration-submit" disabled={submitting}>{submitting ? "Creating account…" : "Create client account"}</button></form>
      <p className="client-registration-signin">Already registered? <Link to="/login">Sign in</Link></p>
    </section>
  </section></main>;
}
