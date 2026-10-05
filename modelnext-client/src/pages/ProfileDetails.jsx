import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const pageStyle = { minHeight: "100vh", background: "var(--mn-bg)", color: "var(--mn-ivory)", padding: "48px 8%", boxSizing: "border-box" };

export default function ProfileDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const name = searchParams.get("name") || "Model";
  const role = searchParams.get("role") || "Fashion model";
  const img = searchParams.get("img") || "";
  const location = searchParams.get("location") || "Sri Lanka";
  return <main style={pageStyle}>
    <button type="button" onClick={() => navigate(-1)} style={{ background: "transparent", color: "var(--mn-ivory)", border: "1px solid var(--mn-border-strong)", borderRadius: 8, cursor: "pointer", padding: "10px 16px", marginBottom: 34 }}>← Back</button>
    <section style={{ maxWidth: 1000, margin: "0 auto", display: "flex", gap: 48, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 290, height: 380, background: "var(--mn-surface-raised)", borderRadius: 14, overflow: "hidden", display: "grid", placeItems: "center", flexShrink: 0 }}>{img ? <img src={img} alt={name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ color: "var(--mn-burgundy)", fontSize: 76, fontWeight: 700 }}>{name.charAt(0).toUpperCase()}</span>}</div>
      <div><p style={{ color: "var(--mn-burgundy)", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>MODEL PROFILE</p><h1 style={{ fontSize: 50, margin: "8px 0" }}>{name}</h1><p style={{ color: "var(--mn-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{role} · {location}</p><p style={{ color: "var(--mn-silver)", maxWidth: 480 }}>This profile was recommended from the approved ModelNext talent directory.</p><button type="button" onClick={() => alert("Booking requests will be available through the event workflow.")} style={{ background: "var(--mn-burgundy)", color: "var(--mn-ivory)", border: 0, borderRadius: 8, padding: "13px 20px", fontWeight: 700, cursor: "pointer" }}>Book talent →</button></div>
    </section>
  </main>;
}
