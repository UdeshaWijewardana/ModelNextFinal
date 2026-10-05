import React from "react";

export default function DashboardStatCard({ icon, label, value, detail, onClick }) {
  const content = <><span className="client-stat-icon" aria-hidden="true">{icon}</span><span className="client-stat-value">{value}</span><span className="client-stat-label">{label}</span><span className="client-stat-detail">{detail}</span></>;
  return onClick ? <button type="button" className="client-stat-card" onClick={onClick}>{content}</button> : <article className="client-stat-card">{content}</article>;
}
