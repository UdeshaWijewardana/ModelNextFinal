import React from "react";
import "../styles/About.css";

const About = () => {
  return (
    <div className="about-container">
      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-overlay"></div>
        {/* Replace with your specific model image */}
        <img
          src="https://images.unsplash.com/photo-1539109136881-3be0610aca58" 
          alt="ModelNext Hero"
          className="hero-bg"
        />
        <div className="hero-content">
          <h1 className="hero-title">About ModelNext</h1>
          <p className="hero-sub">Where Talent Meets Opportunity</p>
          <div className="scroll-indicator">
            <div className="mouse"></div>
            <span>Smooth scroll</span>
          </div>
        </div>
      </section>

      {/* EDITORIAL SPLIT SECTION */}
      <section className="editorial-split container">
        <div className="editorial-image">
          <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f" alt="High Fashion" />
        </div>
        <div className="editorial-text">
          <h2 className="serif">Large elegant typography text platform overview</h2>
          <p>
            ModelNext is a premier destination where elite talent meets global brands. 
            We curate experiences that transcend the traditional modeling agency, 
            utilizing modern technology to empower creators and innovators alike.
          </p>
        </div>
      </section>

      {/* WHAT WE DO - CARD GRID */}
      <section className="card-grid-section container">
        <h2 className="section-header-title">"What We Do" Card Grid</h2>
        <div className="card-grid">
          <div className="premium-card">
            <div className="card-icon">📁</div>
            <h3>Portfolio Creation</h3>
            <p>Premium glasmorphism cards to showcase talent discovery.</p>
          </div>
          <div className="premium-card">
            <div className="card-icon">👤</div>
            <h3>Talent Discovery</h3>
            <p>Premium glasmorphism cards to showcase talent discovery.</p>
          </div>
          <div className="premium-card">
            <div className="card-icon">📅</div>
            <h3>Event Management</h3>
            <p>Premium glasmorphism cards to showcase talent discovery.</p>
          </div>
        </div>
      </section>

      {/* FULL WIDTH BREAK */}
      <section className="image-break">
        <div className="break-overlay"></div>
        <img src="https://images.unsplash.com/photo-1509631179647-0177331693ae" alt="Runway" className="break-img" />
        <h2 className="break-title">Redefining the Modeling Experience</h2>
      </section>

      {/* FEATURES & TRUST SECTION */}
      <section className="features-trust container">
        <div className="features-header">
           <h2 className="serif">Features Section</h2>
           <p>Our high-fashion model images with cinematic lighting and sharp contrast.</p>
        </div>
        
        <div className="features-horizontal">
           <div className="f-item"><span>✦</span> <h4>High Quality</h4></div>
           <div className="f-item"><span>✦</span> <h4>Secure Platform</h4></div>
           <div className="f-item"><span>✦</span> <h4>Collaboration</h4></div>
        </div>

        <div className="trust-box-container">
            <div className="trust-glass-card">
               <div className="shield-icon">🛡️</div>
               <h3>Trust & Reliability</h3>
               <p>Our platform is dedicated and premium, providing a secure environment for agencies and models.</p>
            </div>
        </div>
      </section>

      {/* FINAL STATEMENT */}
      <section className="final-statement">
        <h2 className="serif">Empowering creativity through a modern digital experience</h2>
      </section>
    </div>
  );
};

export default About;