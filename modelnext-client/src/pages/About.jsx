import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/About.css";

const audiences = [
  ["01", "Models", "Build professional profiles, showcase portfolios and discover opportunities."],
  ["02", "Photographers", "Discover talent, create events and collaborate with selected models."],
  ["03", "Agencies", "Manage professional opportunities, discover talent and coordinate events."],
  ["04", "Clients", "Find suitable industry professionals and connect through the platform."],
];

const journey = [
  ["Create profile", "Set up a professional presence that reflects your work and goals."],
  ["Get verified", "Where applicable, complete identity, liveness and approval steps."],
  ["Discover opportunities", "Explore approved profiles, events and opportunities in one place."],
  ["Connect & collaborate", "Bring the right people together around professional work."],
];

const trustFeatures = [
  ["Identity verification", "OCR-assisted identity checks support trustworthy registrations."],
  ["Liveness verification", "A real-person verification workflow is part of model registration."],
  ["Admin approval", "Professional accounts are reviewed before full platform access."],
  ["Secure accounts", "Server-backed authentication helps protect account access."],
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      <Navbar />

      <main>
        <section className="about-hero" aria-labelledby="about-title">
          <div className="about-shell about-hero-grid">
            <div className="about-hero-copy">
              <p className="about-eyebrow">The ModelNext platform</p>
              <h1 id="about-title">About ModelNext</h1>
              <p className="about-hero-lede">Connecting talent, creativity and opportunity.</p>
              <p className="about-copy">
                ModelNext is a centralized digital platform connecting models, photographers,
                agencies and clients around professional profiles, opportunities and events.
              </p>
              <div className="about-hero-actions">
                <button type="button" className="gold-btn" onClick={() => navigate("/register")}>Get started</button>
                <button type="button" className="outline-btn" onClick={() => navigate("/models")}>Explore models</button>
              </div>
            </div>
            <div className="about-hero-visual" aria-hidden="true">
              <div className="about-hero-frame">
                <img src="/assets/hero.jpg" alt="" />
              </div>
              <div className="about-hero-caption">Professional profiles. Meaningful connections.</div>
            </div>
          </div>
        </section>

        <section className="about-section about-purpose" aria-labelledby="purpose-title">
          <div className="about-shell about-purpose-grid">
            <p className="about-eyebrow">Our purpose</p>
            <div>
              <h2 id="purpose-title">Built for the modeling industry</h2>
              <p className="about-copy">
                The modeling ecosystem often relies on fragmented communication, informal networking
                and disconnected platforms. ModelNext brings profiles, opportunities, events and
                professional collaboration into one centralized system.
              </p>
            </div>
          </div>
        </section>

        <section className="about-section" aria-labelledby="connects-title">
          <div className="about-shell">
            <div className="about-section-heading">
              <div>
                <p className="about-eyebrow">Who we connect</p>
                <h2 id="connects-title">One network, four perspectives</h2>
              </div>
              <p className="about-heading-copy">A shared professional space for every role that moves the industry forward.</p>
            </div>
            <div className="about-audience-grid">
              {audiences.map(([number, title, description]) => (
                <article className="about-card" key={title}>
                  <span className="about-card-index">{number}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-section about-process-section" aria-labelledby="process-title">
          <div className="about-shell">
            <div className="about-section-heading about-process-heading">
              <div>
                <p className="about-eyebrow">How ModelNext works</p>
                <h2 id="process-title">From profile to possibility</h2>
              </div>
              <p className="about-heading-copy">A focused journey designed to make professional collaboration easier.</p>
            </div>
            <ol className="about-process">
              {journey.map(([title, description], index) => (
                <li className="about-process-step" key={title}>
                  <span className="about-step-number">0{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="about-section" aria-labelledby="trust-title">
          <div className="about-shell about-trust-layout">
            <div className="about-trust-intro">
              <p className="about-eyebrow">Trust &amp; verification</p>
              <h2 id="trust-title">Designed for professional confidence</h2>
              <p className="about-copy">Thoughtful checks help keep the platform focused on credible professional relationships.</p>
            </div>
            <div className="about-trust-grid">
              {trustFeatures.map(([title, description]) => (
                <article className="about-trust-card" key={title}>
                  <span className="about-trust-mark" aria-hidden="true">✦</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-vision" aria-labelledby="vision-title">
          <div className="about-shell about-vision-content">
            <p className="about-eyebrow">Platform vision</p>
            <h2 id="vision-title">One platform. More opportunities.</h2>
            <p>
              ModelNext aims to provide a professional digital ecosystem where verified talent and
              industry professionals can discover opportunities, organize events and collaborate more efficiently.
            </p>
          </div>
        </section>

        <section className="about-cta" aria-labelledby="cta-title">
          <div className="about-shell about-cta-content">
            <div>
              <p className="about-eyebrow">Your next connection starts here</p>
              <h2 id="cta-title">Ready to join ModelNext?</h2>
              <p>Create your profile and become part of a connected modeling community.</p>
            </div>
            <div className="about-cta-actions">
              <button type="button" className="gold-btn" onClick={() => navigate("/register")}>Get started</button>
              <button type="button" className="outline-btn" onClick={() => navigate("/models")}>Explore models</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
