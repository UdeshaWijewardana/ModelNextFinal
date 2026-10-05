import React from "react";

export default function AdminStatCard({ label, value, detail, tone = "neutral" }) {
  return (
    <article className={`admin-stat-card admin-stat-card-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
