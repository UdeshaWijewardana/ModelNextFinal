import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [role, setRole] = useState('model');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    localStorage.setItem('userRole', role);
    localStorage.setItem('isLoggedIn', 'true');
    navigate(role === 'model' ? '/dashboard' : '/client-portal');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ background: '#FFF', padding: '50px', width: '100%', maxWidth: '420px', border: '1px solid #EAEAEA', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Playfair Display', fontSize: '32px', marginBottom: '10px' }}>ModelNext</h2>
        <p style={{ color: '#666', marginBottom: '40px' }}>Welcome back. Please sign in.</p>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>I am a:</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: '15px', border: '1px solid #ddd' }}>
              <option value="model">Model / Talent</option>
              <option value="client">Client / Organizer</option>
            </select>
          </div>
          <button type="submit" className="btn-gold" style={{ width: '100%' }}>Sign In</button>
        </form>
      </div>
    </div>
  );
};

export default Login;