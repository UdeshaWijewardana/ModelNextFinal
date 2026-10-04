import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const userRole = localStorage.getItem('userRole');

  return (
    <>
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 5%', background: '#F9F5F0', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Playfair Display', fontSize: '24px', fontWeight: '700' }}>ModelNext</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          {isLoggedIn ? (
            <button className="btn-outline" onClick={() => navigate(userRole === 'model' ? '/dashboard' : '/client-portal')}>
              {userRole === 'model' ? 'My Dashboard' : 'Client Portal'}
            </button>
          ) : (
            <button className="btn-outline" onClick={() => navigate('/login')}>Sign In</button>
          )}
        </div>
      </nav>

      <div style={{ padding: '80px 5%', textAlign: 'center', borderBottom: '1px solid #EAEAEA' }}>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: '64px', marginBottom: '20px' }}>THE NEW STANDARD <br /> IN MODELING</h1>
        <p style={{ maxWidth: '500px', margin: '0 auto 40px', lineHeight: '1.6', color: '#666' }}>Discover verified talent, manage bookings, and elevate your creative projects.</p>
        <button className="btn-gold">Explore Talent</button>
      </div>

      <div style={{ padding: '60px 5%' }}>
        <h2 className="section-title">Featured Talent</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
          {[
             { name: 'Amaya P.', role: 'Runway Model', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80' },
             { name: 'Kasun D.', role: 'Photographer', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80' },
             { name: 'Shenali K.', role: 'Commercial', img: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=500&q=80' }
          ].map((talent, index) => (
            <div key={index} style={{ background: '#FFF', padding: '20px', border: '1px solid #EAEAEA' }}>
              <img src={talent.img} alt={talent.name} style={{ width: '100%', height: '320px', objectFit: 'cover', marginBottom: '20px' }} />
              <div style={{ fontFamily: 'Playfair Display', fontSize: '22px', marginBottom: '5px' }}>{talent.name}</div>
              <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '20px' }}>{talent.role}</div>
              <Link to={`/profile?name=${talent.name}&role=${talent.role}&img=${encodeURIComponent(talent.img)}`}>
                <button className="btn-outline" style={{ width: '100%' }}>View Profile</button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Home;