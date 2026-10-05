import React from "react";

const navigation = [
  { id: "overview", label: "Dashboard", glyph: "◼" },
  { id: "pending", label: "Pending review", glyph: "◷" },
  { id: "model", label: "Models", glyph: "◌" },
  { id: "photographer", label: "Photographers", glyph: "◉" },
  { id: "agency", label: "Agencies", glyph: "◇" },
  { id: "client", label: "Clients", glyph: "○" },
  { id: "events", label: "Events", glyph: "□" },
];

export default function AdminSidebar({ activeView, onNavigate, pendingCount }) {
  return (
    <aside className="admin-sidebar" aria-label="Administrator dashboard navigation">
      <div className="admin-sidebar-brand" aria-label="ModelNext">
        <span>Model</span><strong>Next</strong>
      </div>
      <p className="admin-sidebar-kicker">Administration</p>
      <nav className="admin-sidebar-nav">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`admin-sidebar-link ${activeView === item.id ? "is-active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span aria-hidden="true">{item.glyph}</span>
            {item.label}
            {item.id === "pending" && pendingCount > 0 && <b>{pendingCount}</b>}
          </button>
        ))}
      </nav>
      <div className="admin-sidebar-note">
        <span>LIVE DATA</span>
        <p>Registration decisions and identity reviews are protected administrator actions.</p>
      </div>
    </aside>
  );
}
