import { useNavigate } from "react-router-dom";
import "../styles/home.css";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">

      {/* NAVBAR */}
      <nav className="navbar">
        <h1 className="logo">ModelNext</h1>

        <div className="nav-links">
          <span className="active">Discover</span>
          <span>Agencies</span>
          <span>Events</span>
          <span>Lookbook</span>
        </div>

        <div className="nav-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <input placeholder="Search..." />
          <button 
            onClick={() => navigate("/login")} 
            style={{ 
              background: 'transparent', 
              border: '1px solid #1A1A1A', 
              color: '#1A1A1A', 
              padding: '8px 20px', 
              cursor: 'pointer',
              fontWeight: '600',
              textTransform: 'uppercase',
              fontSize: '12px',
              letterSpacing: '1px'
            }}
          >
            LOGIN
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <img
          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2"
          className="hero-bg"
          alt="Hero model"
        />

        <div className="hero-content">
          <h1>
            Define The <br />
            <span>Next Era</span>
          </h1>

          <p>
            The premier digital atelier connecting avant-garde talent with visionary creatives worldwide.
          </p>

          <button onClick={() => navigate("/role")} className="gold-btn">
            JOIN THE NETWORK
          </button>
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

      {/* TRENDING */}
      <section className="trending">
        <h2>Trending Models</h2>

        <div className="grid">
          <div className="card large">
            <img 
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2" 
              alt="Featured model"
            />
          </div>

          <div className="card">
            <img src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1" alt="Model 1" />
          </div>

          <div className="card">
            <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e" alt="Model 2" />
          </div>

          <div className="card">
            <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9" alt="Model 3" />
          </div>

          <div className="card">
            <img src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e" alt="Model 4" />
          </div>
        </div>
      </section>

    </div>
  );
}