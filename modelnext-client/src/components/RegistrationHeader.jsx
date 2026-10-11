import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/RegistrationHeader.css';

export default function RegistrationHeader() {
  return <header className="registration-header"><Link className="registration-wordmark" to="/" aria-label="ModelNext home"><span>Model</span><strong>Next</strong></Link><nav aria-label="Registration navigation"><Link to="/">Back to Website</Link><Link className="registration-signin" to="/login">Sign In</Link></nav></header>;
}
