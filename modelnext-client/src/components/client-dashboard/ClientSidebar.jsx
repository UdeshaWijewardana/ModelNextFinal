import React from "react";

const primaryItems = [
  ["Dashboard", "⌂", "dashboard"],
  ["My Profile", "◉", "profile"],
  ["My Bookings", "▤", "bookings"],
  ["Messages", "◌", "messages"],
  ["Event Group Chats", "◷", "event-chats"],
];

const workspaceItems = [
  ["Discover Talent", "◇", "discover"],
  ["AI Recommendations", "✦", "recommendations"],
  ["Events", "◷", "events"],
];

export default function ClientSidebar({
  isOpen,
  active,
  onNavigate,
  onBackToWebsite,
  onLogout,
  unreadCount,
}) {
  return (
    <aside className={`client-sidebar ${isOpen ? "is-open" : ""}`} aria-label="Client navigation">
      <div className="client-brand"><span className="client-brand-mark">M</span><span><span className="brand-model">Model</span><span className="brand-next">Next</span></span></div>
      <p className="client-sidebar-label">HIRING FOR PROJECTS</p>
      <nav className="client-nav-list">
        {primaryItems.map(([label, icon, key]) => (
          <button key={key} type="button" className={`client-nav-item ${active === key ? "is-active" : ""}`} onClick={() => onNavigate(key)}>
            <span aria-hidden="true">{icon}</span><span>{label}</span>
          </button>
        ))}
        <p className="client-sidebar-label client-sidebar-label--workspace">WORKSPACE</p>
        {workspaceItems.map(([label, icon, key]) => (
          <button key={key} type="button" className={`client-nav-item ${active === key ? "is-active" : ""}`} onClick={() => onNavigate(key)}>
            <span aria-hidden="true">{icon}</span><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="client-sidebar-bottom">
        <button type="button" className="client-nav-item" onClick={() => onNavigate("notifications")}><span aria-hidden="true">◔</span><span>Notifications</span>{unreadCount > 0 && <strong className="client-unread-count">{unreadCount}</strong>}</button>
        <button type="button" className="client-nav-item" onClick={onBackToWebsite}><span aria-hidden="true">←</span><span>Back to Website</span></button>
        <button type="button" className="client-nav-item" onClick={onLogout}><span aria-hidden="true">↗</span><span>Logout</span></button>
      </div>
    </aside>
  );
}
