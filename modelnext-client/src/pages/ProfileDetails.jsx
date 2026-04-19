import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const ProfileDetails = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const name = searchParams.get('name');
  const role = searchParams.get('role');
  const img = searchParams.get('img');

  return (
    <div style={{ padding: '40px 10%' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px' }}>&larr; BACK</button>
        <div style={{ display: 'flex', gap: '50px', alignItems: 'center', borderBottom: '1px solid #E0D6CC', paddingBottom: '40px' }}>
            <img src={img} alt={name} style={{ width: '200px', height: '260px', objectFit: 'cover' }} />
            <div>
                <h1 style={{ fontFamily: 'Playfair Display', fontSize: '56px', margin: '0 0 10px 0' }}>{name}</h1>
                <p style={{ textTransform: 'uppercase', letterSpacing: '1px', color: '#666' }}>{role} • Colombo, Sri Lanka</p>
                <button className="btn-gold" onClick={() => alert('Request sent!')}>Book Talent</button>
            </div>
        </div>
    </div>
  );
};

export default ProfileDetails;