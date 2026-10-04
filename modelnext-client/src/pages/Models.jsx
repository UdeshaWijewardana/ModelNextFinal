import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiFetch, readJson } from "../api";
import "../styles/Models.css";
export default function Models() { const [models, setModels] = useState([]); const [error, setError] = useState(""); useEffect(() => { apiFetch("/models").then(readJson).then(({ models: items }) => setModels(items)).catch((err) => setError(err.message)); }, []); return <div className="models-page"><Navbar /><main className="models-container"><h1>Fashion Models</h1>{error && <p>{error}</p>}{models.map((model) => <article className="model-card" key={model._id}><img className="model-img" src={model.profileImage ? `http://localhost:5000/${model.profileImage}` : ""} alt="" /><h3>{model.fullName}</h3><p>{model.categories?.join(", ")}</p><p>{model.location}</p></article>)}{!error && models.length === 0 && <p>No approved models are listed yet.</p>}</main></div>; }
