import React from "react";
import Navbar from "../components/Navbar";
import "../styles/Photographers.css";

const PHOTOGRAPHERS = [
  {
    id: 1,
    name: "Marcus Vance",
    style: "High Contrast / Avant-Garde",
    location: "Paris, France",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80",
    work: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=300&q=80"
    ]
  },
  {
    id: 2,
    name: "Elena Rostova",
    style: "Editorial / Haute Couture",
    location: "Milan, Italy",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
    work: [
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=300&q=80"
    ]
  },
  {
    id: 3,
    name: "Kai Chen",
    style: "Streetwear / Cyberpunk",
    location: "Tokyo, Japan",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
    work: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1505022610485-0249ba5b3675?auto=format&fit=crop&w=300&q=80"
    ]
  },
  {
    id: 4,
    name: "Chloe Dubois",
    style: "Natural Light / Portraiture",
    location: "New York, USA",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
    work: [
      "https://images.unsplash.com/photo-1496449903678-68ddcb189a24?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=300&q=80"
    ]
  }
];

export default function Photographers() {
  return (
    <div className="photographers-page">
      <Navbar />

      <div className="photographers-hero">
        <div className="photographers-hero-content">
          <h1>Creative <span className="gold-text">Photographers</span></h1>
          <p>Scout vanguard fashion lensmen and visual directors defining the aesthetics of tomorrow.</p>
        </div>
      </div>

      <div className="photographers-container">
        <div className="photographers-grid">
          {PHOTOGRAPHERS.map((photographer) => (
            <div key={photographer.id} className="photographer-card">
              <div className="photographer-profile-section">
                <div className="photographer-avatar-wrapper">
                  <img src={photographer.image} alt={photographer.name} className="photographer-avatar" />
                </div>
                <div className="photographer-meta">
                  <h3 className="photographer-name">{photographer.name}</h3>
                  <div className="photographer-style">{photographer.style}</div>
                  <div className="photographer-location">📍 {photographer.location}</div>
                </div>
              </div>

              <div className="photographer-portfolio-preview">
                <div className="preview-label">Recent Shoots</div>
                <div className="preview-images">
                  {photographer.work.map((workImg, idx) => (
                    <img key={idx} src={workImg} alt="Work preview" className="portfolio-preview-img" />
                  ))}
                  <div className="portfolio-more-overlay">
                    <span>+15</span>
                  </div>
                </div>
              </div>

              <div className="photographer-actions">
                <button className="book-btn">Book Shoot</button>
                <button className="portfolio-btn">View Gallery</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
