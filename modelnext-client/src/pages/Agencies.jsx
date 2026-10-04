import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiFetch, readJson } from "../api";
import "../styles/Agencies.css";
export default function Agencies() { const [agencies, setAgencies] = useState([]); const [error, setError] = useState(""); useEffect(() => { apiFetch("/agencies").then(readJson).then(({ agencies: items }) => setAgencies(items)).catch((err) => setError(err.message)); }, []); return <div className="agencies-page"><Navbar /><main className="agencies-container"><h1>Elite Agencies</h1>{error && <p>{error}</p>}{agencies.map((agency) => <article className="agency-card" key={agency._id}><h3>{agency.agencyName}</h3><p>{agency.address}</p><p>{agency.ownerName}</p></article>)}{!error && agencies.length === 0 && <p>No approved agencies are listed yet.</p>}</main></div>; }
