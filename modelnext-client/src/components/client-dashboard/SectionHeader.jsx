import React from "react";

export default function SectionHeader({ eyebrow, title, action, onAction }) {
  return <div className="client-section-header"><div>{eyebrow && <p className="client-eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action && <button type="button" className="client-text-button" onClick={onAction}>{action} <span aria-hidden="true">→</span></button>}</div>;
}
