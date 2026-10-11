import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SERVER_BASE_URL } from "../api";
import RegistrationHeader from "../components/RegistrationHeader";
import "../styles/agencyForm.css";

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 5 * 1024 * 1024;
const initialForm = { agencyName: "", ownerName: "", phone: "", email: "", address: "", businessId: "", password: "", confirmPassword: "", profileImage: null, coverImage: null };

export default function AgencyForm() {
  const navigate = useNavigate(); const inFlight = useRef(false);
  const profileInput = useRef(null); const coverInput = useRef(null); const previewUrls = useRef({ profile: "", cover: "" });
  const [form, setForm] = useState(initialForm); const [preview, setPreview] = useState({ profile: "", cover: "" });
  const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  useEffect(() => () => Object.values(previewUrls.current).forEach(url => { if (url) URL.revokeObjectURL(url); }), []);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const setImage = (field, file) => {
    if (!file) return;
    if (!imageTypes.includes(file.type)) return setError("Choose JPEG, PNG, or WebP images.");
    if (file.size > maxImageSize) return setError("Each image must be 5 MiB or smaller.");
    const key = field === "profileImage" ? "profile" : "cover";
    if (previewUrls.current[key]) URL.revokeObjectURL(previewUrls.current[key]);
    const url = URL.createObjectURL(file); previewUrls.current[key] = url;
    setPreview(current => ({ ...current, [key]: url })); setForm(current => ({ ...current, [field]: file })); setError("");
  };
  const removeImage = field => {
    const key = field === "profileImage" ? "profile" : "cover"; if (previewUrls.current[key]) URL.revokeObjectURL(previewUrls.current[key]); previewUrls.current[key] = "";
    setPreview(current => ({ ...current, [key]: "" })); setForm(current => ({ ...current, [field]: null }));
    const input = field === "profileImage" ? profileInput.current : coverInput.current; if (input) input.value = "";
  };
  const submit = async event => {
    event.preventDefault(); setError("");
    const required = ["agencyName", "ownerName", "phone", "email", "address", "password", "confirmPassword"];
    if (required.some(key => !String(form[key]).trim()) || !form.profileImage) return setError("Complete every required field, including the agency logo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Enter a valid email address.");
    if (!/^[+()\-\s0-9]{7,25}$/.test(form.phone)) return setError("Enter a valid contact number.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (inFlight.current) return; inFlight.current = true; setSubmitting(true);
    const data = new FormData(); ["agencyName", "ownerName", "phone", "email", "address", "businessId", "password"].forEach(key => { if (form[key]) data.append(key, form[key]); }); data.append("profileImage", form.profileImage); if (form.coverImage) data.append("coverImage", form.coverImage);
    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/agencies/register`, { method: "POST", body: data, credentials: "include" });
      const json = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : null;
      if (!response.ok) throw new Error(json?.error || "Unable to submit agency registration.");
      navigate("/agency-dashboard", { state: { registrationSubmitted: true }, replace: true });
    } catch (caught) { setError(caught.message || "Unable to submit agency registration."); }
    finally { inFlight.current = false; setSubmitting(false); }
  };
  const upload = (field, title, optional, inputRef) => { const key = field === "profileImage" ? "profile" : "cover"; return <section className={`agency-media-block agency-media-block--${key}`}><div className="agency-media-heading"><div><strong>{title}</strong><span>{optional ? "Optional" : "Required"}</span></div>{preview[key] && <button type="button" onClick={() => removeImage(field)}>Remove</button>}</div><div className="agency-media-preview">{preview[key] ? <img src={preview[key]} alt={`Selected ${title.toLowerCase()} preview`} /> : <span aria-hidden="true">{key === "profile" ? "A" : "◇"}</span>}</div><label className="agency-upload-button">{preview[key] ? `Replace ${title.toLowerCase()}` : `Choose ${title.toLowerCase()}`}<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImage(field, event.target.files?.[0])} /></label><small>JPEG, PNG, or WebP · maximum 5 MiB</small></section>; };
  return <main className="agency-registration-page"><RegistrationHeader /><section className="agency-registration-shell"><aside className="agency-registration-media"><p className="agency-registration-kicker">MODELNEXT / AGENCY NETWORK</p><h1>Shape the industry’s next chapter.</h1><p>Present your agency with a polished identity before administrator review.</p>{upload("coverImage", "Cover image", true, coverInput)}{upload("profileImage", "Agency logo", false, profileInput)}</aside>
    <section className="agency-registration-card"><p className="agency-registration-kicker">AGENCY APPLICATION</p><h2>Create your agency account</h2><p className="agency-registration-copy">Business and contact details remain private unless explicitly shown on your public profile.</p>{error && <p className="agency-form-error" role="alert">{error}</p>}<form onSubmit={submit} noValidate><fieldset><legend>Agency identity</legend><div className="agency-form-grid"><label>Agency name<input name="agencyName" value={form.agencyName} onChange={update} required /></label><label>Owner name<input name="ownerName" autoComplete="name" value={form.ownerName} onChange={update} required /></label><label className="agency-form-wide">Business ID <span>Optional</span><input name="businessId" value={form.businessId} onChange={update} /></label></div></fieldset><fieldset><legend>Contact information</legend><div className="agency-form-grid"><label>Contact number<input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} required /></label><label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required /></label><label className="agency-form-wide">Office address<input name="address" autoComplete="street-address" value={form.address} onChange={update} required /></label></div></fieldset><fieldset><legend>Account credentials</legend><div className="agency-form-grid"><label>Password<input name="password" type="password" autoComplete="new-password" value={form.password} onChange={update} required /></label><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update} required /></label></div></fieldset><button className="agency-registration-submit" disabled={submitting}>{submitting ? "Creating account…" : "Create agency account"}</button></form><p className="agency-registration-signin">Already registered? <Link to="/login">Sign in</Link></p></section>
  </section></main>;
}
