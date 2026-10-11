import React from 'react';
import { Link } from 'react-router-dom';

export default function BrowseTalentLinks({ className = '' }) {
  return <nav className="browse-talent-links" aria-label="Browse talent">
    {[
      ['/models', 'Browse Fashion Models'],
      ['/photographers', 'Browse Photographers'],
      ['/agencies', 'Browse Agencies'],
    ].map(([path, label]) => <Link key={path} className={className} to={path} target="_blank" rel="noopener noreferrer">{label}</Link>)}
  </nav>;
}
