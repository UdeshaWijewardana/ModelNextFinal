import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PhotographerDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Initialize photographerData in localStorage if it doesn't exist
  React.useEffect(() => {
    if (!localStorage.getItem('photographerData')) {
      const defaultPhoto = {
        name: "Alex Mercer",
        email: "alex@mercerphoto.com",
        phone: "+33 6 1234 5678",
        location: "Paris, France",
        portfolio: "https://alexmercer.portfolio",
        profileImage: "https://images.unsplash.com/photo-1554046920-90dc5f3ac186?auto=format&fit=crop&w=300&q=80",
        verified: false
      };
      localStorage.setItem('photographerData', JSON.stringify(defaultPhoto));
      if (!localStorage.getItem('currentUser')) {
        localStorage.setItem('currentUser', JSON.stringify({
          role: 'photographer',
          email: defaultPhoto.email,
          name: defaultPhoto.name,
          verified: false
        }));
      }
    }
  }, []);

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    portfolio: ""
  });

  // Sync edit form with localStorage
  React.useEffect(() => {
    const data = JSON.parse(localStorage.getItem('photographerData'));
    if (data) {
      setEditForm({
        name: data.name || "Alex Mercer",
        email: data.email || "alex@mercerphoto.com",
        phone: data.phone || "+33 6 1234 5678",
        location: data.location || "Paris, France",
        portfolio: data.portfolio || ""
      });
    }
  }, [activeTab, updateTrigger]);

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };

  const handleProfileSave = (e) => {
    e.preventDefault();
    const currentData = JSON.parse(localStorage.getItem('photographerData')) || {};
    const updatedPhoto = {
      ...currentData,
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      location: editForm.location,
      portfolio: editForm.portfolio
    };
    localStorage.setItem('photographerData', JSON.stringify(updatedPhoto));

    // Update currentUser if applicable
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && currentUser.role === 'photographer') {
      localStorage.setItem('currentUser', JSON.stringify({
        ...currentUser,
        email: editForm.email,
        name: editForm.name,
        location: editForm.location,
        phone: editForm.phone
      }));
    }

    setUpdateTrigger(prev => prev + 1);
    alert("Profile details updated successfully!");
  };

  const handleRequestVerification = () => {
    const currentPhoto = JSON.parse(localStorage.getItem('photographerData')) || {};
    const requests = JSON.parse(localStorage.getItem('verificationRequests')) || [];

    if (requests.some(r => r.email === currentPhoto.email && r.status === 'PENDING')) {
      alert("You already have a pending verification request.");
      return;
    }

    const newRequest = {
      id: Math.random().toString(),
      name: currentPhoto.name || "Alex Mercer",
      email: currentPhoto.email || "alex@mercerphoto.com",
      role: 'photographer',
      location: currentPhoto.location || "Paris, France",
      status: 'PENDING'
    };

    localStorage.setItem('verificationRequests', JSON.stringify([...requests, newRequest]));
    setUpdateTrigger(prev => prev + 1);
    alert("Verification request submitted to Admin Dashboard!");
  };

  // Retrieve photographer data from localStorage
  const storedPhotoData = JSON.parse(localStorage.getItem('photographerData')) || {};
  const profileImageUrl = storedPhotoData.profileImage 
    ? (storedPhotoData.profileImage.startsWith('http') ? storedPhotoData.profileImage : `http://localhost:5000/${storedPhotoData.profileImage.replace(/\\/g, '/')}`)
    : "https://images.unsplash.com/photo-1554046920-90dc5f3ac186?auto=format&fit=crop&w=300&q=80";

  const photoData = {
    profile: {
      name: storedPhotoData.name || "Alex Mercer",
      type: "Professional Photographer",
      profileImage: profileImageUrl,
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

  const isPhotoVerified = storedPhotoData.verified === true;
  const verRequests = JSON.parse(localStorage.getItem('verificationRequests')) || [];
  const isVerificationPending = verRequests.some(r => r.email === (storedPhotoData.email || "alex@mercerphoto.com") && r.status === 'PENDING');

  const notifications = JSON.parse(localStorage.getItem('userNotifications')) || [];
  const myNotifs = notifications.filter(n => n.userEmail === (storedPhotoData.email || "alex@mercerphoto.com"));

  const handleClearNotifications = () => {
    const allNotifs = JSON.parse(localStorage.getItem('userNotifications')) || [];
    const filtered = allNotifs.filter(n => n.userEmail !== (storedPhotoData.email || "alex@mercerphoto.com"));
    localStorage.setItem('userNotifications', JSON.stringify(filtered));
    setUpdateTrigger(prev => prev + 1);
  };

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div onClick={() => navigate("/")} style={{...styles.logo, cursor: 'pointer'}}><span>♦</span> ModelNext</div>
        <nav>
          <div style={styles.navItem('dashboard')} onClick={() => setActiveTab('dashboard')}><i className="fa-solid fa-camera"></i> Dashboard</div>
          <div style={styles.navItem('gigs')} onClick={() => setActiveTab('gigs')}><i className="fa-regular fa-calendar-check"></i> Bookings</div>

          <div style={styles.navItem('account')} onClick={() => setActiveTab('account')}><i className="fa-regular fa-user"></i> My Account</div>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '15px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <img src={photoData.profile.profileImage} alt="user" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover'}} />
          <div><div style={{fontWeight:'600', fontSize:'14px'}}>{storedPhotoData.name || 'Alex Mercer'}</div><div onClick={() => {localStorage.clear(); navigate('/')}} style={{fontSize:'12px', color:'#999', cursor:'pointer'}}>Logout</div></div>
        </div>
      </aside>

      <main style={styles.mainContent}>
        <div style={styles.headerProfile}>
          <img src={photoData.profile.profileImage} style={styles.mainImage} alt="Profile" />
          <div style={{ paddingTop: '20px' }}>
             <h1 style={styles.nameTitle}>{photoData.profile.name.toUpperCase()} {isPhotoVerified && <span style={styles.verifiedBadge} title="Verified Photographer">✓</span>}</h1>
             <p style={{ color: '#666', marginTop: '10px', letterSpacing: '1px' }}>{isPhotoVerified ? "VERIFIED PHOTOGRAPHER" : "PRO PHOTOGRAPHER"}</p>
          </div>
        </div>

        {activeTab === 'dashboard' && (
            <div style={styles.gridContainer}>
              <div>
                 {/* Notifications Hub */}
                 {myNotifs.length > 0 && (
                   <div style={{ background: '#FFEBEE', border: '1px solid #E57373', borderRadius: '8px', padding: '20px', marginBottom: '30px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                       <h3 style={{ margin: 0, fontSize: '13px', color: '#C62828', fontWeight: 'bold', letterSpacing: '0.5px' }}>🔔 DEACTIVATION NOTIFICATIONS</h3>
                       <button onClick={handleClearNotifications} style={{ background: 'transparent', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textDecoration: 'underline' }}>Clear All</button>
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                       {myNotifs.map(n => (
                         <div key={n.id} style={{ fontSize: '12.5px', color: '#C62828', background: '#FFF', padding: '10px 15px', borderRadius: '4px', borderLeft: '3px solid #D32F2F', lineHeight: '1.4' }}>
                           {n.message}
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

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
                      <div style={styles.circleChart}><div style={styles.innerCircle}>{storedPhotoData.name ? 100 : 90}%</div></div>
                      <p style={{fontSize:'13px', color:'#666', marginBottom:'20px', lineHeight:'1.5'}}>Showcase more work to attract premium clients.</p>
                      <button onClick={() => setActiveTab('account')} style={{background:'#1A1A1A', color:'#FFF', border:'none', padding:'15px 0', width:'100%', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', cursor:'pointer'}}>EDIT PROFILE</button>
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



        {activeTab === 'account' && (
          <div style={{ background: '#FFF', padding: '40px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', borderRadius: '8px' }}>
            <h2 style={{ ...styles.sectionTitle, fontSize: '28px', marginBottom: '10px' }}>My Account Details</h2>
            <p style={{ color: '#666', marginBottom: '30px', fontSize: '14px' }}>View and update your photographer profile details.</p>
            
            {/* Verification Request Container */}
            <div style={{ background: '#FFF9E6', border: '1px solid #C5A572', padding: '20px', borderRadius: '6px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '15px', color: '#1A1A1A', fontWeight: 'bold' }}>Verification Badge</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: '1.4' }}>
                  {isPhotoVerified 
                    ? "Congratulations! Your profile has been verified by editors." 
                    : isVerificationPending 
                      ? "Your verification request has been received and is pending administrator review."
                      : "Request a verified badge to show creative clients your work is fully verified."}
                </p>
              </div>
              <div>
                {isPhotoVerified ? (
                  <span style={{ background: '#E8F5E9', color: '#2E7D32', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>VERIFIED ✓</span>
                ) : isVerificationPending ? (
                  <span style={{ background: '#FFF3E0', color: '#E65100', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>VERIFICATION PENDING</span>
                ) : (
                  <button type="button" onClick={handleRequestVerification} style={{ background: '#C5A572', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.5px' }}>
                    REQUEST BADGE
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>FULL NAME</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="name" value={editForm.name} onChange={handleEditChange} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>EMAIL ADDRESS</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} type="email" name="email" value={editForm.email} onChange={handleEditChange} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>LOCATION</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="location" value={editForm.location} onChange={handleEditChange} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>CONTACT NUMBER</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="phone" value={editForm.phone} onChange={handleEditChange} required />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>PORTFOLIO / WEBSITE LINK</label>
                <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="portfolio" value={editForm.portfolio} onChange={handleEditChange} />
              </div>

              <button type="submit" style={{ background: '#1A1A1A', color: '#FFF', border: 'none', padding: '16px', fontWeight: 'bold', letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', fontSize: '13px' }}>
                SAVE PROFILE DETAILS
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default PhotographerDashboard;
