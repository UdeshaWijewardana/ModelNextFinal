import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PhotographerDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  const photoData = {
    profile: {
      name: "Alex Mercer",
      type: "Professional Photographer",
      profileImage: "https://images.unsplash.com/photo-1554046920-90dc5f3ac186?auto=format&fit=crop&w=300&q=80",
      stats: { profileCompletion: 90 }
    },
    gigs: [
      { id: 1, client: "Vogue Magazine", type: "Editorial Shoot", date: "August 20, 2026", status: "CONFIRMED" },
      { id: 2, client: "Elite Models", type: "Comp Card Test", date: "August 25, 2026", status: "PENDING" },
    ],
    portfolio: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
    ]
  };

  const styles = {
    container: { display: 'flex', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif", background: '#F9F5F0' },
    sidebar: { width: '250px', background: '#FFF', padding: '40px 30px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #EAEAEA', position: 'fixed', height: '100%' },
    logo: { fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: '700', marginBottom: '60px', display:'flex', alignItems:'center', gap:'10px' },
    navItem: (name) => ({ padding: '15px 20px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', color: activeTab === name ? '#1A1A1A' : '#666', fontWeight: activeTab === name ? '600' : '400', background: activeTab === name ? '#F9F5F0' : 'transparent', borderRadius: '8px', margin: '0 -20px'}),
    mainContent: { marginLeft: '250px', flex: 1, padding: '60px 80px' },
    headerProfile: { display: 'flex', gap: '40px', alignItems: 'flex-start', marginBottom: '60px' },
    mainImage: { width: '200px', height: '250px', objectFit: 'cover', filter: 'grayscale(30%)' },
    nameTitle: { fontFamily: "'Playfair Display', serif", fontSize: '64px', margin: '0', lineHeight: '1' },
    verifiedBadge: { background: '#C5A572', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', marginLeft: '15px', verticalAlign: 'middle' },
    gridContainer: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '50px' },
    sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '30px' },
    card: { background: '#FFF', padding: '25px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' },
    cardTitle: { fontWeight: '700', fontSize: '16px', marginBottom: '5px' },
    cardSub: { fontSize: '13px', color: '#888', marginBottom: '20px' },
    tag: { fontSize: '10px', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold', float: 'right' },
    statusCard: { background: '#FFF', padding: '40px', textAlign: 'center' },
    circleChart: { width: '120px', height: '120px', borderRadius: '50%', background: `conic-gradient(#C5A572 ${photoData.profile.stats.profileCompletion}%, #EAEAEA 0)`, margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    innerCircle: { width: '100px', height: '100px', background: '#FFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontSize: '28px', color: '#C5A572' },
    portfolioGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '60px' },
    portfolioImg: { width: '100%', height: '200px', objectFit: 'cover' }
  };

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}><span>♦</span> ModelNext</div>
        <nav>
          <div style={styles.navItem('dashboard')} onClick={() => setActiveTab('dashboard')}><i className="fa-solid fa-camera"></i> Dashboard</div>
          <div style={styles.navItem('gigs')} onClick={() => setActiveTab('gigs')}><i className="fa-regular fa-calendar-check"></i> Bookings</div>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '15px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <img src={photoData.profile.profileImage} alt="user" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover'}} />
          <div><div style={{fontWeight:'600', fontSize:'14px'}}>Alex Mercer</div><div onClick={() => {localStorage.clear(); navigate('/')}} style={{fontSize:'12px', color:'#999', cursor:'pointer'}}>Logout</div></div>
        </div>
      </aside>

      <main style={styles.mainContent}>
        <div style={styles.headerProfile}>
          <img src={photoData.profile.profileImage} style={styles.mainImage} alt="Profile" />
          <div style={{ paddingTop: '20px' }}>
             <h1 style={styles.nameTitle}>ALEX <br/> MERCER <span style={styles.verifiedBadge}>✓</span></h1>
             <p style={{ color: '#666', marginTop: '10px', letterSpacing: '1px' }}>PRO PHOTOGRAPHER</p>
          </div>
        </div>

        {activeTab === 'dashboard' && (
            <div style={styles.gridContainer}>
              <div>
                 <h2 style={styles.sectionTitle}>Portfolio Preview</h2>
                 <div style={styles.portfolioGrid}>
                    {photoData.portfolio.map((img, i) => <img key={i} src={img} style={styles.portfolioImg} alt={`p${i}`}/>)}
                 </div>

                 <h2 style={{...styles.sectionTitle, fontSize:'24px'}}>Recent Bookings</h2>
                 <div>
                    {photoData.gigs.map((gig) => (
                        <div key={gig.id} style={styles.card}>
                            <span style={{...styles.tag, background: gig.status === 'CONFIRMED' ? '#E8F5E9' : '#FFF3E0', color: gig.status === 'CONFIRMED' ? '#2E7D32' : '#E65100'}}>
                                {gig.status}
                            </span>
                            <div style={styles.cardTitle}>{gig.client}</div>
                            <div style={styles.cardSub}>{gig.type} <br/> {gig.date}</div>
                        </div>
                    ))}
                 </div>
              </div>
              <div>
                  <div style={styles.statusCard}>
                      <h3 style={{fontFamily:"'Playfair Display', serif", fontSize:'22px', marginBottom:'30px'}}>Profile Status</h3>
                      <div style={styles.circleChart}><div style={styles.innerCircle}>{photoData.profile.stats.profileCompletion}%</div></div>
                      <p style={{fontSize:'13px', color:'#666', marginBottom:'20px', lineHeight:'1.5'}}>Showcase more work to attract premium clients.</p>
                      <button style={{background:'#1A1A1A', color:'#FFF', border:'none', padding:'15px 0', width:'100%', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', cursor:'pointer'}}>UPLOAD PORTFOLIO</button>
                  </div>
              </div>
            </div>
        )}

        {activeTab === 'gigs' && (
            <div>
               <h2 style={styles.sectionTitle}>All Bookings</h2>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                   {photoData.gigs.map((gig) => (
                      <div key={gig.id} style={styles.card}>
                          <div style={styles.cardTitle}>{gig.client}</div>
                          <div style={styles.cardSub}>{gig.type} - {gig.date}</div>
                          <div style={{display:'flex', gap:'10px'}}>
                              <button style={{background:'#C5A572', color:'#FFF', border:'none', padding:'10px', flex:1, fontSize:'10px', fontWeight:'bold', cursor:'pointer'}}>VIEW DETAILS</button>
                          </div>
                      </div>
                   ))}
               </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default PhotographerDashboard;
