import React from "react";
import Navbar from "../components/Navbar";
import "../styles/Agencies.css";

const AGENCIES = [
  {
    id: 1,
    name: "Vanguard Model Management",
    location: "Paris / Milan / New York",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    tags: ["High Fashion", "Runway", "Editorial"],
    rating: "5.0",
    description: "The global authority in scouting and representing high-fashion models for top luxury brands."
  },
  {
    id: 2,
    name: "Eclipse Talent Partners",
    location: "London / Tokyo / Los Angeles",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    tags: ["Commercial", "Creative", "Digital"],
    rating: "4.9",
    description: "Empowering diverse creators, models, and digital artists with innovative global career development."
  },
  {
    id: 3,
    name: "Luminous Models & Talents",
    location: "Sydney / Barcelona / Berlin",
    image: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80",
    tags: ["Sustainability", "Editorial", "Fitness"],
    rating: "4.8",
    description: "An ethical talent agency focusing on sustainable partnerships, editorial storytelling, and wellness."
  },
  {
    id: 4,
    name: "Aura Creative Agency",
    location: "New York / Stockholm / Copenhagen",
    image: "https://images.unsplash.com/photo-1542744094-3a31f103e35f?auto=format&fit=crop&w=800&q=80",
    tags: ["Minimalist", "Avant-Garde", "Couture"],
    rating: "5.0",
    description: "Specialized boutique representing couture icons, avant-garde creatives, and boundary-pushing artists."
  },
  {
    id: 5,
    name: "Apex Elite Scouting",
    location: "Milan / Rome / Florence",
    image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80",
    tags: ["Scouting", "New Faces", "Runway"],
    rating: "4.7",
    description: "The premier Italian agency dedicated to discovering new faces and launching international careers."
  },
  {
    id: 6,
    name: "Nova Representational",
    location: "Toronto / Miami / Chicago",
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
    tags: ["Lifestyle", "Commercial", "Influencer"],
    rating: "4.8",
    description: "Connecting top brands with engaging lifestyle models, creative influencers, and commercial talent."
  }
];

export default function Agencies() {
  return (
    <div className="agencies-page">
      <Navbar />
      
      <div className="agencies-hero">
        <div className="agencies-hero-content">
          <h1>Elite <span className="gold-text">Agencies</span></h1>
          <p>Connecting top-tier talent with visionary global representations and couture brands.</p>
        </div>
      </div>

      <div className="agencies-container">
        <div className="agencies-grid">
          {AGENCIES.map((agency) => (
            <div key={agency.id} className="agency-card">
              <div className="agency-image-wrapper">
                <img src={agency.image} alt={agency.name} className="agency-image" />
                <div className="agency-rating">★ {agency.rating}</div>
              </div>
              <div className="agency-info">
                <div className="agency-location">{agency.location}</div>
                <h3 className="agency-name">{agency.name}</h3>
                <p className="agency-desc">{agency.description}</p>
                <div className="agency-tags">
                  {agency.tags.map((tag, idx) => (
                    <span key={idx} className="agency-tag">{tag}</span>
                  ))}
                </div>
                <button className="agency-btn">Explore Roster</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
