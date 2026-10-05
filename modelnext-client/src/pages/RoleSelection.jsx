import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/RoleSelection.css";

function RoleIcon({ type }) {
  const paths = {
    model: <><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
    photographer: <><path d="M4 8h3l1.3-2h7.4L17 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="14" r="3.25" /></>,
    agency: <><path d="M4 20V6l8-3 8 3v14" /><path d="M8 20v-5h8v5M8 9h.01M12 9h.01M16 9h.01" /></>,
    client: <><path d="M5 20V9l7-5 7 5v11" /><path d="M9 20v-5h6v5M9 11h.01M15 11h.01" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[type]}</svg>;
}

const roles = [
  { value: "model", name: "Model", description: "Find opportunities, build your portfolio and grow your career.", image: "hero" },
  { value: "photographer", name: "Photographer", description: "Showcase your work, discover talent and connect with creative projects.", image: "photographer", imageSrc: `${process.env.PUBLIC_URL}/assets/role-photographer.png` },
  { value: "agency", name: "Agency", description: "Manage talent and connect models with clients and opportunities.", image: "editorial" },
  { value: "client", name: "Client", description: "Discover the right talent and create professional fashion projects.", image: "client", imageSrc: `${process.env.PUBLIC_URL}/assets/role-client.png` },
];

export default function RoleSelection() {
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const continueRegistration = () => {
    if (selected) navigate(`/register/${selected}`);
  };

  return (
    <main className="role-selection-page">
      <section className="role-editorial" aria-label="ModelNext fashion editorial">
        <div className="role-editorial-top">
          <div className="role-wordmark" aria-label="ModelNext">
            <span>Model</span><span>Next</span>
          </div>
          <p>Talent • Creativity • Opportunity</p>
        </div>
        <p className="role-editorial-statement">Real talent.<br />Real projects.<br />Real opportunities.</p>
      </section>

      <section className="role-registration" aria-labelledby="role-selection-title">
        <div className="role-registration-topline">
          <p>Already have an account?</p>
          <button type="button" className="role-sign-in" onClick={() => navigate("/login")}>Sign In</button>
        </div>

        <div className="role-registration-content">
          <p className="role-eyebrow">Welcome to ModelNext</p>
          <h1 id="role-selection-title">Select Your Role</h1>
          <p className="role-intro">Join as a model, photographer, agency or client and become part of the ModelNext fashion and creative community.</p>

          <div className="role-grid" aria-label="Choose your registration role">
            {roles.map((role) => {
              const isSelected = selected === role.value;
              return (
                <button
                  key={role.value}
                  type="button"
                  className={`role-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => setSelected(role.value)}
                  aria-pressed={isSelected}
                >
                  <span className={`role-card-media role-card-media--${role.image}`} style={role.imageSrc ? { backgroundImage: `url(${role.imageSrc})` } : undefined} aria-hidden="true" />
                  <span className="role-card-content">
                    <span className="role-card-icon"><RoleIcon type={role.value} /></span>
                    <span className="role-card-copy">
                      <span className="role-card-title">{role.name}</span>
                      <span className="role-card-description">{role.description}</span>
                    </span>
                    <span className="role-card-arrow" aria-hidden="true">↗</span>
                  </span>
                  <span className="role-card-status">{isSelected ? "Selected" : "Select role"}</span>
                </button>
              );
            })}
          </div>

          <button type="button" className="role-register-button" disabled={!selected} onClick={continueRegistration}>
            Register Now <span aria-hidden="true">→</span>
          </button>

          <div className="role-footer-links">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </section>
    </main>
  );
}
