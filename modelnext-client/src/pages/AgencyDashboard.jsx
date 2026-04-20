import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AgencyDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Retrieve agency data from localStorage
  const storedAgencyData = JSON.parse(localStorage.getItem('agencyData')) || {};
  const profileImageUrl = storedAgencyData.profileImage 
    ? `http://localhost:5000/${storedAgencyData.profileImage.replace(/\\/g, '/')}` 
    : "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=300&q=80";

  // Hardcoded placeholder data for visual presentation combined with stored data
  const agencyData = {
    profile: {
      name: storedAgencyData.agencyName || "Elite Model Management",
      type: "Premium Agency",
      profileImage: profileImageUrl,
      stats: { profileCompletion: 85 }
    },
    models: [
      { id: 1, name: "Isabella Rossi", status: "Active" },
      { id: 2, name: "Marcus Johnson", status: "Active" },
    ],
    castings: [
      { id: 1, title: "Vogue Summer Editorial", date: "August 15, 2026", status: "OPEN" },
      { id: 2, title: "Gucci Runway Show", date: "September 10, 2026", status: "CLOSED" }
    ]
  };

  const styles = {
    container: { display: 'flex', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif", background: '#F9F5F0' },
    sidebar: { width: '250px', background: '#FFF', padding: '40px 30px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #EAEAEA', position: 'fixed', height: '100%' },
    logo: { fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: '700', marginBottom: '60px', display:'flex', alignItems:'center', gap:'10px' },
    navItem: (name) => ({ padding: '15px 20px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', color: activeTab === name ? '#1A1A1A' : '#666', fontWeight: activeTab === name ? '600' : '400', background: activeTab === name ? '#F9F5F0' : 'transparent', borderRadius: '8px', margin: '0 -20px'}),
    mainContent: { marginLeft: '250px', flex: 1, padding: '60px 80px' },
    headerProfile: { display: 'flex', gap: '40px', alignItems: 'flex-start', marginBottom: '60px' },
    mainImage: { width: '200px', height: '250px', objectFit: 'cover', filter: 'grayscale(50%)' },
    nameTitle: { fontFamily: "'Playfair Display', serif", fontSize: '64px', margin: '0', lineHeight: '1' },
    verifiedBadge: { background: '#C5A572', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', marginLeft: '15px', verticalAlign: 'middle' },
    gridContainer: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '50px' },
    sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '30px' },
    card: { background: '#FFF', padding: '25px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' },
    cardTitle: { fontWeight: '700', fontSize: '16px', marginBottom: '5px' },
    cardSub: { fontSize: '13px', color: '#888', marginBottom: '20px' },
    tag: { fontSize: '10px', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold', float: 'right' },
    statusCard: { background: '#FFF', padding: '40px', textAlign: 'center' },
    circleChart: { width: '120px', height: '120px', borderRadius: '50%', background: `conic-gradient(#C5A572 ${agencyData.profile.stats.profileCompletion}%, #EAEAEA 0)`, margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    innerCircle: { width: '100px', height: '100px', background: '#FFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontSize: '28px', color: '#C5A572' }
  };

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}><span>♦</span> ModelNext</div>
        <nav>
          <div style={styles.navItem('dashboard')} onClick={() => setActiveTab('dashboard')}><i className="fa-solid fa-table-cells-large"></i> Dashboard</div>
          <div style={styles.navItem('models')} onClick={() => setActiveTab('models')}><i className="fa-solid fa-users"></i> Manage Models</div>
          <div style={styles.navItem('castings')} onClick={() => setActiveTab('castings')}><i className="fa-regular fa-calendar"></i> Casting Calls</div>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '15px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <img src={agencyData.profile.profileImage} alt="user" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover'}} />
          <div><div style={{fontWeight:'600', fontSize:'14px'}}>{storedAgencyData.ownerName || 'Admin'}</div><div onClick={() => {localStorage.clear(); navigate('/')}} style={{fontSize:'12px', color:'#999', cursor:'pointer'}}>Logout</div></div>
        </div>
      </aside>

      <main style={styles.mainContent}>
        <div style={styles.headerProfile}>
          <img src={agencyData.profile.profileImage} style={styles.mainImage} alt="Agency Profile" />
          <div style={{ paddingTop: '20px' }}>
             <h1 style={styles.nameTitle}>{agencyData.profile.name.toUpperCase()} <span style={styles.verifiedBadge}>✓</span></h1>
             <p style={{ color: '#666', marginTop: '10px', letterSpacing: '1px' }}>VERIFIED AGENCY</p>
          </div>
        </div>

        {activeTab === 'dashboard' && (
            <div style={styles.gridContainer}>
              <div>
                 <h2 style={styles.sectionTitle}>Recent Casting Calls</h2>
                 <div>
                    {agencyData.castings.length === 0 ? <p>No castings yet.</p> : agencyData.castings.map((casting) => (
                        <div key={casting.id} style={styles.card}>
                            <span style={{...styles.tag, background: casting.status === 'OPEN' ? '#E8F5E9' : '#EEE', color: casting.status === 'OPEN' ? '#2E7D32' : '#333'}}>
                                {casting.status}
                            </span>
                            <div style={styles.cardTitle}>{casting.title}</div>
                            <div style={styles.cardSub}>{casting.date}</div>
                        </div>
                    ))}
                 </div>
              </div>
              <div>
                  <div style={styles.statusCard}>
                      <h3 style={{fontFamily:"'Playfair Display', serif", fontSize:'22px', marginBottom:'30px'}}>Agency Status</h3>
                      <div style={styles.circleChart}><div style={styles.innerCircle}>{agencyData.profile.stats.profileCompletion}%</div></div>
                      <p style={{fontSize:'13px', color:'#666', marginBottom:'20px', lineHeight:'1.5'}}>Complete your agency profile to attract top talent.</p>
                      <button style={{background:'#1A1A1A', color:'#FFF', border:'none', padding:'15px 0', width:'100%', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', cursor:'pointer'}}>EDIT PROFILE</button>
                  </div>
              </div>
            </div>
        )}

        {activeTab === 'models' && (
            <div>
               <h2 style={styles.sectionTitle}>Manage Models</h2>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                   {agencyData.models.map((model) => (
                      <div key={model.id} style={styles.card}>
                          <div style={styles.cardTitle}>{model.name}</div>
                          <div style={styles.cardSub}>Status: {model.status}</div>
                          <div style={{display:'flex', gap:'10px'}}>
                              <button style={{background:'#C5A572', color:'#FFF', border:'none', padding:'10px', flex:1, fontSize:'10px', fontWeight:'bold', cursor:'pointer'}}>VIEW PORTFOLIO</button>
                          </div>
                      </div>
                   ))}
               </div>
            </div>
        )}

        {activeTab === 'castings' && (
            <div>
               <h2 style={styles.sectionTitle}>All Casting Calls</h2>
               <p>Create and manage your agency's casting calls here.</p>
               <button style={{background:'#1A1A1A', color:'#FFF', border:'none', padding:'10px 20px', cursor:'pointer', marginTop:'20px'}}>+ CREATE NEW CASTING</button>
            </div>
        )}
      </main>
    </div>
  );
};

export default AgencyDashboard;
