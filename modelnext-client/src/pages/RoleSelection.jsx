import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/RoleSelection.css";

export default function RoleSelection() {

  // 🟢 State to store selected role
  const [selected, setSelected] = useState(null);

  // 🟢 React Router navigation
  const navigate = useNavigate();

  // 🟢 Role list data
  const roles = [
    { name: "Model", desc: "Looking for opportunities", value: "model", icon: "👤" },
    { name: "Photographer", desc: "Scouting new faces", value: "photographer", icon: "📷" },
    { name: "Agency", desc: "Managing talent", value: "agency", icon: "🏢" },
    { name: "Client", desc: "Hiring for projects", value: "client", icon: "👜" },
  ];

  return (
    <div className="role-container">

      {/* LEFT SIDE IMAGE + BRAND */}
      <div className="role-left">
        <div className="overlay"></div>

        <div className="brand">
          <h1>ModelNext</h1>
          <p>IDENTITY. AUTHENTICITY. ELEGANCE.</p>
        </div>
      </div>

      {/* RIGHT SIDE CONTENT */}
      <div className="role-right">

        {/* PAGE TITLE */}
        <h1 className="title">Welcome</h1>

        {/* SUBTITLE */}
        <p className="subtitle">Select your role to begin</p>

        {/* ROLE LIST */}
        <div className="role-list">
          {roles.map((role) => (
            <div
              key={role.value} // unique key
              className={`role-item ${selected === role.value ? "active" : ""}`}
              onClick={() => setSelected(role.value)} // set selected role
            >
              <div className="icon">{role.icon}</div>

              <div>
                <h3>{role.name}</h3>
                <p>{role.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* REGISTER BUTTON */}
        <button
          className="register-btn"
          disabled={!selected} // disabled until role selected
          onClick={() => navigate(`/register/${selected}`)} // go to new page
        >
          REGISTER NOW →
        </button>

        {/* FOOTER LINKS */}
        <div className="footer-links">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>

      </div>
    </div>
  );
}