import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const primaryItems = [
  ["Dashboard", "⌂", "dashboard"],
  ["Discover Talent", "◇", "discover"],
  ["AI Recommendations", "✦", "recommendations"],
  ["My Projects", "▣", "projects"],
  ["All Bookings", "▤", "bookings"],
  ["Messages", "◌", "messages"],
  ["Saved Talent", "♡", "saved"],
  ["Events", "◷", "events"],
];

export default function ClientSidebar({ isOpen, active, onNavigate, unreadCount }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const signOut = async () => { await logout(); navigate("/"); };
  return (
    <aside className={`client-sidebar ${isOpen ? "is-open" : ""}`} aria-label="Client navigation">
      <div className="client-brand"><span className="client-brand-mark">M</span><span><span className="brand-model">Model</span><span className="brand-next">Next</span></span></div>
      <p className="client-sidebar-label">HIRING FOR PROJECTS</p>
      <nav className="client-nav-list">
        <button type="button" className="client-nav-item" onClick={() => navigate("/event-chats")}>Event group chats</button>
        {primaryItems.map(([label, icon, key]) => (
          <button key={key} type="button" className={`client-nav-item ${active === key ? "is-active" : ""}`} onClick={() => onNavigate(key)}>
            <span aria-hidden="true">{icon}</span><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="client-sidebar-bottom">
        <button type="button" className="client-nav-item" onClick={() => onNavigate("notifications")}><span aria-hidden="true">◔</span><span>Notifications</span>{unreadCount > 0 && <strong className="client-unread-count">{unreadCount}</strong>}</button>
        <button type="button" className="client-nav-item" onClick={() => onNavigate("settings")}><span aria-hidden="true">⚙</span><span>Profile &amp; Settings</span></button>
        <button type="button" className="client-nav-item" onClick={signOut}><span aria-hidden="true">↗</span><span>Logout</span></button>
      </div>
    </aside>
  );
}
