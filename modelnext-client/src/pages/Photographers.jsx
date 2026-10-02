import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiFetch, readJson } from "../api";
import "../styles/Photographers.css";
export default function Photographers() { const [photographers, setPhotographers] = useState([]); const [error, setError] = useState(""); useEffect(() => { readJson(apiFetch("/photographers")).then(({ photographers: items }) => setPhotographers(items)).catch((err) => setError(err.message)); }, []); return <div className="photographers-page"><Navbar /><main className="photographers-container"><h1>Creative Photographers</h1>{error && <p>{error}</p>}{photographers.map((person) => <article className="photographer-card" key={person._id}><h3>{person.name}</h3><p>{person.location}</p><p>{person.portfolio}</p></article>)}{!error && photographers.length === 0 && <p>No approved photographers are listed yet.</p>}</main></div>; }
