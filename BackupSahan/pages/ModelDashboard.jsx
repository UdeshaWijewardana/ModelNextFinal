import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ModelDashboard = () => {
  const navigate = useNavigate();
  const [modelData, setModelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); 

  // ✅ FIXED ID (MATCHES SEED.JS)
  const MODEL_ID = "65ca10000000000000000001"; 

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => { fetchData(true); }, 3000); // Check every 3s
    return () => clearInterval(interval);
  }, []);

  const fetchData = (silent = false) => {
    fetch(`http://localhost:5000/api/dashboard/${MODEL_ID}`)
      .then(res => res.json())
      .then(data => { 
          setModelData(data); 
          if (!silent) setLoading(false); 
      })
      .catch(err => console.error(err));
  };

  const handleApply = async (event) => {
    // Optimistic Update: Move event to bookings list immediately
    const tempBooking = {
        _id: Math.random(), // Temp ID
        clientName: event.clientName,
        jobType: event.jobType,
        date: event.date,
        status: 'APPLIED'
    };
    
    setModelData(prev => ({
        ...prev,
        bookings: [tempBooking, ...prev.bookings],
        events: prev.events.filter(e => e._id !== event._id)
    }));

    await fetch('http://localhost:5000/api/dashboard/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            clientName: event.clientName,
            jobType: event.jobType,
            date: event.date,
            modelId: MODEL_ID, 
            status: 'APPLIED', 
            isEvent: false 
        })
    });
    // Re-fetch to get the real DB ID
    fetchData(true);
  };

  const handleStatusUpdate = async (bookingId, newStatus) => {
      await fetch(`http://localhost:5000/api/dashboard/booking/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData(true);
  };

  if (loading) return <div style={{padding:'50px'}}>Loading...</div>;

  // ... (Keep your styles same as before) ...
  const styles = {
    container: { display: 'flex', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif", background: '#F9F5F0' },
    sidebar: { width: '250px', background: '#FFF', padding: '40px 30px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #EAEAEA', position: 'fixed', height: '100%' },
    logo: { fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: '700', marginBottom: '60px', display:'flex', alignItems:'center', gap:'10px' },
    navItem: (name) => ({ padding: '15px 20px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', color: activeTab === name ? '#1A1A1A' : '#666', fontWeight: activeTab === name ? '600' : '400', background: activeTab === name ? '#F9F5F0' : 'transparent', borderRadius: '8px', margin: '0 -20px'}),
    mainContent: { marginLeft: '250px', flex: 1, padding: '60px 80px' },
    headerProfile: { display: 'flex', gap: '40px', alignItems: 'flex-start', marginBottom: '60px' },
    mainImage: { width: '200px', height: '250px', objectFit: 'cover', filter: 'grayscale(100%)' },
    nameTitle: { fontFamily: "'Playfair Display', serif", fontSize: '64px', margin: '0', lineHeight: '1' },
    verifiedBadge: { background: '#C5A572', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', marginLeft: '15px', verticalAlign: 'middle' },
    gridContainer: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '50px' },
    sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '30px' },
    portfolioGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '60px' },
    portfolioImg: { width: '100%', height: '200px', objectFit: 'cover' },
    card: { background: '#FFF', padding: '25px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' },
    cardTitle: { fontWeight: '700', fontSize: '16px', marginBottom: '5px' },
    cardSub: { fontSize: '13px', color: '#888', marginBottom: '20px' },
    tag: { fontSize: '10px', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold', float: 'right' },
    statusCard: { background: '#FFF', padding: '40px', textAlign: 'center' },
    circleChart: { width: '120px', height: '120px', borderRadius: '50%', background: `conic-gradient(#C5A572 ${modelData.profile.stats.profileCompletion}%, #EAEAEA 0)`, margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    innerCircle: { width: '100px', height: '100px', background: '#FFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontSize: '28px', color: '#C5A572' }
  };

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}><span>♦</span> ModelNext</div>
        <nav>
          <div style={styles.navItem('dashboard')} onClick={() => setActiveTab('dashboard')}><i className="fa-solid fa-table-cells-large"></i> Dashboard</div>
          <div style={styles.navItem('events')} onClick={() => setActiveTab('events')}><i className="fa-regular fa-calendar"></i> Events</div>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '15px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <img src={modelData.profile.profileImage} alt="user" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover'}} />
          <div><div style={{fontWeight:'600', fontSize:'14px'}}>{modelData.profile.name}</div><div onClick={() => {localStorage.clear(); navigate('/')}} style={{fontSize:'12px', color:'#999', cursor:'pointer'}}>Logout</div></div>
        </div>
      </aside>

      <main style={styles.mainContent}>
        <div style={styles.headerProfile}>
          <img src={modelData.profile.profileImage} style={styles.mainImage} alt="Main Profile" />
          <div style={{ paddingTop: '20px' }}>
             <h1 style={styles.nameTitle}>ISABELLA <br/> ROSSI <span style={styles.verifiedBadge}>✓</span></h1>
             <p style={{ color: '#666', marginTop: '10px', letterSpacing: '1px' }}>VERIFIED MODEL</p>
          </div>
        </div>

        {activeTab === 'dashboard' && (
            <div style={styles.gridContainer}>
              <div>
                 <h2 style={styles.sectionTitle}>Portfolio Preview</h2>
                 <div style={styles.portfolioGrid}>
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" style={styles.portfolioImg} alt="p1"/>
                    <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=300&q=80" style={styles.portfolioImg} alt="p2"/>
                    <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80" style={styles.portfolioImg} alt="p3"/>
                 </div>

                 <div>
                    <h2 style={{...styles.sectionTitle, fontSize:'24px'}}>Applications & Bookings</h2>
                    {modelData.bookings.length === 0 ? <p>No bookings yet.</p> : modelData.bookings.map((booking) => (
                        <div key={booking._id} style={styles.card}>
                            <span style={{...styles.tag, background: booking.status === 'CONFIRMED' ? '#E8F5E9' : booking.status === 'APPLIED' ? '#FFF3E0' : '#EEE', color: booking.status === 'CONFIRMED' ? '#2E7D32' : booking.status === 'APPLIED' ? '#E65100' : '#333'}}>
                                {booking.status === 'APPLIED' ? 'Pending Approval' : booking.status}
                            </span>
                            <div style={styles.cardTitle}>{booking.clientName}</div>
                            <div style={styles.cardSub}>{booking.jobType} <br/> {booking.date}</div>
                            {booking.status === 'NEW' && (<button className="btn-outline" style={{width:'100%', fontSize:'11px'}} onClick={() => handleStatusUpdate(booking._id, 'ACCEPTED')}>ACCEPT INVITE</button>)}
                        </div>
                    ))}
                 </div>
              </div>
              <div>
                  <div style={styles.statusCard}>
                      <h3 style={{fontFamily:"'Playfair Display', serif", fontSize:'22px', marginBottom:'30px'}}>Profile Status</h3>
                      <div style={styles.circleChart}><div style={styles.innerCircle}>{modelData.profile.stats.profileCompletion}%</div></div>
                      <p style={{fontSize:'13px', color:'#666', marginBottom:'20px', lineHeight:'1.5'}}>Complete your profile to unlock more opportunities.</p>
                      <button style={{background:'#1A1A1A', color:'#FFF', border:'none', padding:'15px 0', width:'100%', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', cursor:'pointer'}}>COMPLETE PROFILE</button>
                  </div>
              </div>
            </div>
        )}

        {activeTab === 'events' && (
            <div>
               <h2 style={styles.sectionTitle}>Public Casting Calls</h2>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                   {modelData.events.length === 0 ? <p>No new public events found.</p> : modelData.events.map((event) => (
                      <div key={event._id} style={styles.card}>
                          <div style={styles.cardTitle}>{event.clientName}</div>
                          <div style={styles.cardSub}>{event.jobType} <br/> {event.date}</div>
                          <p style={{fontSize:'13px', color:'#555', marginBottom:'20px'}}>This event is open for public applications.</p>
                          <div style={{display:'flex', gap:'10px'}}>
                              <button className="btn-gold" style={{flex:1, fontSize:'10px', padding:'10px 0'}} onClick={() => handleApply(event)}>APPLY NOW</button>
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

export default ModelDashboard;