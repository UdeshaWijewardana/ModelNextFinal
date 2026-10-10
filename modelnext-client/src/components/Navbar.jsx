import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();
  const { status, account, accountRoute, isAuthenticated, logout, kind } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeAndNavigate = (path) => { navigate(path); setIsOpen(false); };
  const goBack = () => {
    const hasInternalHistory = window.history.state?.idx > 0 || document.referrer.startsWith(window.location.origin);
    navigate(hasInternalHistory ? -1 : '/');
    setIsOpen(false);
  };
  const signOut = async () => {
    await logout();
    closeAndNavigate('/');
  };
  const accountName = account?.name || account?.fullName || account?.agencyName || 'My Account';

  const authActions = (mobile = false) => {
    if (status === 'loading') return <div className={`nav-auth-loading ${mobile ? 'is-mobile' : ''}`} aria-label="Checking session" />;
    if (!isAuthenticated) return <>
      <button className="nav-btn-login" onClick={() => closeAndNavigate('/login')}>LOGIN</button>
      <button className="nav-btn-register" onClick={() => closeAndNavigate('/register')}>REGISTER</button>
    </>;
    return <>
      <button className="nav-btn-subtle" onClick={goBack}>BACK</button>
      <button className="nav-btn-login" onClick={() => closeAndNavigate(accountRoute)}>MY ACCOUNT</button>
      {!mobile && <span className="nav-user-label" title={accountName}>{accountName}</span>}
      <button className="nav-btn-register nav-btn-logout" onClick={signOut}>LOGOUT</button>
    </>;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* LOGO */}
        <div className="navbar-logo" onClick={() => { navigate('/'); setIsOpen(false); }}>
          <span className="brand-model">Model</span><span className="brand-next">Next</span>
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
            to="/about"
            className={({ isActive }) => `nav-item nav-item-secondary ${isActive ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            About Us
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
            className={({ isActive }) => `nav-item nav-item-secondary ${isActive ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            Contact Us
          </NavLink>

          {isAuthenticated && kind === 'user' && <NavLink to="/event-chats" className="nav-item" onClick={() => setIsOpen(false)}>Group Chats</NavLink>}
          {/* MOBILE ACTIONS */}
          <div className="mobile-actions">{authActions(true)}</div>
        </div>

        {/* DESKTOP ACTIONS */}
        <div className="nav-actions-desktop">{authActions()}</div>
      </div>
    </nav>
  );
}
