import React from "react";

export default function AdminSectionCard({ eyebrow, title, action, children, className = "" }) {
  return (
    <section className={`admin-section-card ${className}`.trim()}>
      <header className="admin-section-heading">
        <div>
          {eyebrow && <p>{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
