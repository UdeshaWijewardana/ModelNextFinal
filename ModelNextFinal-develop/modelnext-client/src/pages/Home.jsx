import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import "../styles/home.css";

export default function Home() {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);
  const bannerRef = useRef(null);
  const [offsetY, setOffsetY] = useState(0);

  const featuredModels = [
    {
      name: "Aurelia Rose",
      number: "MN-2048",
      title: "Editorial & Luxury Runway",
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
    },
    {
      name: "Mila Laurent",
      number: "MN-1874",
      title: "Commercial & Fashion Week",
      image:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1",
    },
    {
      name: "Noah Sterling",
      number: "MN-2210",
      title: "High-End Brand Campaigns",
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
    },
    {
      name: "Elena Voss",
      number: "MN-1932",
      title: "Beauty & Bridal Editorial",
      image:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9",
    },
    {
      name: "Julian Cross",
      number: "MN-2089",
      title: "Luxury Lifestyle Campaigns",
      image:
        "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e",
    },
  ];

  useEffect(() => {
    // Video sound control logic can go here if needed
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (bannerRef.current) {
        const rect = bannerRef.current.getBoundingClientRect();
        const parentTop = rect.top;
        const viewportHeight = window.innerHeight;
        if (parentTop < viewportHeight && parentTop > -rect.height) {
          const scrollProgress = (viewportHeight - parentTop) / (viewportHeight + rect.height);
          setOffsetY((scrollProgress - 0.5) * 150);
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSound = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="home">

      {/* NAVBAR */}
      <Navbar />

      {/* HERO */}
      <section className="hero">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="hero-bg"
        >
          <source src="/assets/thunder.mp4" type="video/mp4" />
        </video>

        <button className={`sound-btn ${isMuted ? "muted" : ""}`} onClick={toggleSound} title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? "🔇" : "🔊"}
        </button>

        <div className="hero-content">
          <h1>Define The Next Era</h1>

          <p>
            The premier digital atelier connecting avant-garde talent with visionary creatives worldwide.
          </p>

          <div className="hero-buttons">
            <button onClick={() => navigate("/role")} className="gold-btn">
              JOIN THE NETWORK
            </button>
            <button onClick={() => navigate("/register/client")} className="outline-btn">
              HIRE FASHIONS MODELS
            </button>
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section className="roles">

        <div className="role-card" onClick={() => navigate("/role")}>
          <img
            src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e"
            alt="Models"
          />
          <div className="overlay"></div>
          <div className="role-content">
            <h3>Models</h3>
            <p>Explore Portfolios →</p>
          </div>
        </div>

        <div className="role-card" onClick={() => navigate("/role")}>
          <img
            src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32"
            alt="Photographers"
          />
          <div className="overlay"></div>
          <div className="role-content">
            <h3>Photographers</h3>
            <p>Find Talent →</p>
          </div>
        </div>

        <div className="role-card" onClick={() => navigate("/role")}>
          <img
            src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30"
            alt="Agencies"
          />
          <div className="overlay"></div>
          <div className="role-content">
            <h3>Agencies</h3>
            <p>Scout Roster →</p>
          </div>
        </div>

      </section>

      {/* PARALLAX BANNER: WHAT IS MODEL HUB */}
      <section className="parallax-banner" ref={bannerRef}>
        <div
          className="parallax-bg"
          style={{
            transform: `translateY(${offsetY}px) translateZ(0) scale(1.15)`
          }}
        ></div>
        <div className="parallax-overlay"></div>
        <div className="parallax-content">
          <h2>What is Model Hub?</h2>
          <p className="subtitle">THE ULTIMATE DIGITAL FASHION ECOSYSTEM</p>
          <div className="divider"></div>
          <p className="description">
            Model Hub is a cutting-edge, centralized directory and collaborative platform that bridges the gap between top-tier models, professional photographers, and leading booking agencies. We streamline portfolio discovery, simplify event coordination, and empower creators to turn visual concepts into high-fashion realities.
          </p>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="why-choose-us">
        <div className="section-header">
          <h2>Why Choose Us?</h2>
          <p>Elevating industry standards through connection, efficiency, and professional representation.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">✨</div>
            <h3>Visionary Network</h3>
            <p>Access a curated directory of elite talent, distinguished photographers, and renowned agencies worldwide.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🤝</div>
            <h3>Direct Collaboration</h3>
            <p>Communicate, negotiate, and collaborate directly without unnecessary middlemen or hidden fees.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📅</div>
            <h3>Seamless Bookings</h3>
            <p>Coordinate bookings and plan high-profile fashion events using our robust scheduling and tracking tools.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Global Exposure</h3>
            <p>Put your portfolio in front of the industry's decision-makers, scouts, and artistic directors daily.</p>
          </div>
        </div>
      </section>

      {/* TRENDING */}
      <section className="trending">
        <div className="trending-header">
          <div>
            <p className="section-tag">Curated Talent</p>
            <h2>Trending Models</h2>
          </div>
          <p className="trending-copy">
            Discover elite models registered on our luxury platform and secure your next editorial or campaign booking.
          </p>
        </div>

        <div className="trending-grid">
          {featuredModels.map((model, index) => (
            <article className={`model-card ${index === 0 ? "large" : ""}`} key={model.number}>
              <img src={model.image} alt={model.name} />
              <div className="model-overlay"></div>
              <div className="model-content">
                <span className="model-badge">{model.number} • Registered</span>
                <h3>{model.name}</h3>
                <p>{model.title}</p>
                <button
                  type="button"
                  className="book-btn"
                  onClick={() => navigate("/register/client")}
                >
                  Book Now
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

    </div>
  );
}