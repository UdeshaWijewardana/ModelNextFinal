import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../styles/Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* LOGO */}
        <div className="navbar-logo" onClick={() => { navigate('/'); setIsOpen(false); }}>
          ModelNext
        </div>

        {/* MOBILE MENU TOGGLE */}
        <div className={`menu-toggle ${isOpen ? 'open' : ''}`} onClick={toggleMenu}>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </div>

        {/* NAV LINKS */}
        <div className={`nav-menu ${isOpen ? 'active' : ''}`}>
          <NavLink 
            to="/" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            Home
          </NavLink>
          <NavLink 
            to="/agencies" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            Agencies
          </NavLink>
          <NavLink 
            to="/models" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            Fashion Models
          </NavLink>
          <NavLink 
            to="/photographers" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            Photographers
          </NavLink>
          <NavLink 
            to="/events" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            Events
          </NavLink>
          <NavLink 
            to="/contact" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            Contact Us
          </NavLink>

          {/* MOBILE ACTIONS */}
          <div className="mobile-actions">
            <button className="nav-btn-login" onClick={() => { navigate('/login'); setIsOpen(false); }}>
              LOGIN
            </button>
            <button className="nav-btn-register" onClick={() => { navigate('/register'); setIsOpen(false); }}>
              REGISTER
            </button>
          </div>
        </div>

        {/* DESKTOP ACTIONS */}
        <div className="nav-actions-desktop">
          <button className="nav-btn-login" onClick={() => navigate('/login')}>
            LOGIN
          </button>
          <button className="nav-btn-register" onClick={() => navigate('/register')}>
            REGISTER
          </button>
        </div>
      </div>
    </nav>
  );
}
