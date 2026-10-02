import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiFetch, getCurrentUser, readJson } from "../api";

export default function EventCreate() {
  const navigate = useNavigate(); const [user, setUser] = useState(null); const [form, setForm] = useState({ title: "", eventType: "Runway", startDate: "", endDate: "", location: "", description: "" }); const [error, setError] = useState("");
  useEffect(() => { getCurrentUser().then(({ user: current }) => setUser(current)).catch(() => navigate("/login")); }, [navigate]);
  const submit = async (event) => { event.preventDefault(); try { await readJson(await apiFetch("/events", { method: "POST", body: JSON.stringify(form) })); navigate("/events"); } catch (err) { setError(err.message); } };
  if (!user) return <main style={{ padding: 40 }}>Loading account...</main>;
  if (user.role === "model") return <main style={{ padding: 40 }}>Models cannot create events.</main>;
  return <><Navbar /><main style={{ maxWidth: 650, margin: "40px auto" }}><h1>Create event</h1>{error && <p style={{ color: "#b00020" }}>{error}</p>}<form onSubmit={submit}>{Object.entries(form).map(([field, value]) => <label key={field} style={{ display: "block", margin: 10 }}>{field}<input required={field !== "endDate"} type={field.includes("Date") ? "datetime-local" : "text"} value={value} onChange={(e) => setForm({ ...form, [field]: e.target.value })} style={{ display: "block", width: "100%" }} /></label>)}<button>Submit for approval</button></form></main></>;
}
