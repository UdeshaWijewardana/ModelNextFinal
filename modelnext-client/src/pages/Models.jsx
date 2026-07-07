import React, { useState } from "react";
import Navbar from "../components/Navbar";
import "../styles/Models.css";

const MODELS = [
  {
    id: 1,
    name: "Sophia Vance",
    category: "Runway",
    height: "179 cm / 5'10.5\"",
    eyes: "Green",
    measurements: "81-60-88",
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80",
    agency: "Vanguard Model Management"
  },
  {
    id: 2,
    name: "Liam Sterling",
    category: "Editorial",
    height: "188 cm / 6'2\"",
    eyes: "Blue",
    measurements: "98-76-95",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
    agency: "Vanguard Model Management"
  },
  {
    id: 3,
    name: "Amara Diop",
    category: "Runway",
    height: "180 cm / 5'11\"",
    eyes: "Dark Brown",
    measurements: "83-61-89",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
    agency: "Eclipse Talent Partners"
  },
  {
    id: 4,
    name: "Yuki Sato",
    category: "Commercial",
    height: "175 cm / 5'9\"",
    eyes: "Brown",
    measurements: "84-62-90",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
    agency: "Luminous Models"
  },
  {
    id: 5,
    name: "Elena Rostova",
    category: "Editorial",
    height: "178 cm / 5'10\"",
    eyes: "Hazel",
    measurements: "82-59-87",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
    agency: "Aura Creative Agency"
  },
  {
    id: 6,
    name: "Marcus Ward",
    category: "Commercial",
    height: "186 cm / 6'1\"",
    eyes: "Grey",
    measurements: "100-80-97",
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80",
    agency: "Nova Representational"
  }
];

export default function Models() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredModels = activeCategory === "All" 
    ? MODELS 
    : MODELS.filter(model => model.category === activeCategory);

  return (
    <div className="models-page">
      <Navbar />

      <div className="models-hero">
        <div className="models-hero-content">
          <h1>Fashion <span className="gold-text">Models</span></h1>
          <p>Explore portfolios of the most promising and established faces in couture and commercial media.</p>
        </div>
      </div>

      <div className="models-container">
        {/* FILTERS */}
        <div className="models-filters">
          {["All", "Runway", "Editorial", "Commercial"].map((cat) => (
            <button 
              key={cat} 
              className={`filter-btn ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* GRID */}
        <div className="models-grid">
          {filteredModels.map((model) => (
            <div key={model.id} className="model-card">
              <div className="model-img-wrapper">
                <img src={model.image} alt={model.name} className="model-img" />
                <span className="model-badge">{model.category}</span>
              </div>
              <div className="model-details">
                <h3 className="model-name">{model.name}</h3>
                <div className="model-agency">{model.agency}</div>
                
                <div className="model-stats">
                  <div className="stat-row">
                    <span className="stat-label">Height:</span>
                    <span className="stat-val">{model.height}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Eyes:</span>
                    <span className="stat-val">{model.eyes}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Bust-Waist-Hips:</span>
                    <span className="stat-val">{model.measurements}</span>
                  </div>
                </div>

                <button className="model-view-btn">View Portfolio</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
