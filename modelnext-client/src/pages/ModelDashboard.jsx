import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ModelDashboard = () => {
  const navigate = useNavigate();
  const [modelData, setModelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [updateTrigger, setUpdateTrigger] = useState(0); 

  // ✅ FIXED ID (MATCHES SEED.JS)
  const MODEL_ID = "65ca10000000000000000001"; 

  // Initialize modelData in localStorage if it doesn't exist
  useEffect(() => {
    if (!localStorage.getItem('modelData')) {
      const defaultModel = {
        fullName: "Isabella Rossi",
        email: "isabella@modelnext.com",
        location: "Milan, Italy",
        phone: "+39 333 444 555",
        weight: "58",
        height: "178",
        waist: "61",
        hip: "89",
        profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
        verified: false
      };
      localStorage.setItem('modelData', JSON.stringify(defaultModel));
      if (!localStorage.getItem('currentUser')) {
        localStorage.setItem('currentUser', JSON.stringify({
          role: 'model',
          email: defaultModel.email,
          name: defaultModel.fullName,
          verified: false
        }));
      }
    }
  }, []);

  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    location: "",
    phone: "",
    weight: "",
    height: "",
    waist: "",
    hip: ""
  });

  // Sync edit form with localStorage when tab changes
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('modelData'));
    if (data) {
      setEditForm({
        fullName: data.fullName || data.name || "Isabella Rossi",
        email: data.email || "isabella@modelnext.com",
        location: data.location || "Milan, Italy",
        phone: data.phone || "+39 333 444 555",
        weight: data.weight || "58",
        height: data.height || "178",
        waist: data.waist || "61",
        hip: data.hip || "89"
      });
    }
  }, [activeTab, updateTrigger]);

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
      .catch(err => {
          console.error(err);
          // Set dummy modelData so page compiles if backend server is offline
          setModelData({ bookings: [], events: [] });
          if (!silent) setLoading(false);
      });
  };

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };

  const handleProfileSave = (e) => {
    e.preventDefault();
    const currentData = JSON.parse(localStorage.getItem('modelData')) || {};
    const updatedModel = {
      ...currentData,
      fullName: editForm.fullName,
      email: editForm.email,
      location: editForm.location,
      phone: editForm.phone,
      weight: editForm.weight,
      height: editForm.height,
      waist: editForm.waist,
      hip: editForm.hip
    };
    localStorage.setItem('modelData', JSON.stringify(updatedModel));
    
    // Update currentUser if applicable
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && currentUser.role === 'model') {
      localStorage.setItem('currentUser', JSON.stringify({
        ...currentUser,
        email: editForm.email,
        name: editForm.fullName,
        location: editForm.location,
        phone: editForm.phone
      }));
    }

    setUpdateTrigger(prev => prev + 1);
    alert("Profile details updated successfully!");
  };

  const handleRequestVerification = () => {
    const currentModel = JSON.parse(localStorage.getItem('modelData')) || {};
    const requests = JSON.parse(localStorage.getItem('verificationRequests')) || [];
    
    if (requests.some(r => r.email === currentModel.email && r.status === 'PENDING')) {
      alert("You already have a pending verification request.");
      return;
    }

    const newRequest = {
      id: Math.random().toString(),
      name: currentModel.fullName || currentModel.name || "Isabella Rossi",
      email: currentModel.email || "isabella@modelnext.com",
      role: 'model',
      location: currentModel.location || "Milan, Italy",
      status: 'PENDING'
    };
    
    localStorage.setItem('verificationRequests', JSON.stringify([...requests, newRequest]));
    setUpdateTrigger(prev => prev + 1);
    alert("Verification request submitted to Admin Dashboard!");
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

  const storedModel = JSON.parse(localStorage.getItem('modelData')) || {};
  const isModelVerified = storedModel.verified === true;
  const verRequests = JSON.parse(localStorage.getItem('verificationRequests')) || [];
  const isVerificationPending = verRequests.some(r => r.email === (storedModel.email || "isabella@modelnext.com") && r.status === 'PENDING');
  const modelProfileImage = storedModel.profileImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80";
  const modelNameText = storedModel.fullName || "Isabella Rossi";

  // Notifications Hub setup
  const notifications = JSON.parse(localStorage.getItem('userNotifications')) || [];
  const myNotifs = notifications.filter(n => n.userEmail === (storedModel.email || "isabella@modelnext.com"));

  const handleClearNotifications = () => {
    const allNotifs = JSON.parse(localStorage.getItem('userNotifications')) || [];
    const filtered = allNotifs.filter(n => n.userEmail !== (storedModel.email || "isabella@modelnext.com"));
    localStorage.setItem('userNotifications', JSON.stringify(filtered));
    setUpdateTrigger(prev => prev + 1);
  };

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div onClick={() => navigate("/")} style={{...styles.logo, cursor: 'pointer'}}><span>♦</span> ModelNext</div>
        <nav>
          <div style={styles.navItem('dashboard')} onClick={() => setActiveTab('dashboard')}><i className="fa-solid fa-table-cells-large"></i> Dashboard</div>
          <div style={styles.navItem('events')} onClick={() => setActiveTab('events')}><i className="fa-regular fa-calendar"></i> Events</div>

          <div style={styles.navItem('account')} onClick={() => setActiveTab('account')}><i className="fa-regular fa-user"></i> My Account</div>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '15px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <img src={modelProfileImage} alt="user" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover'}} />
          <div>
            <div style={{fontWeight:'600', fontSize:'14px'}}>{modelNameText}</div>
            <div onClick={() => {localStorage.clear(); navigate('/')}} style={{fontSize:'12px', color:'#999', cursor:'pointer'}}>Logout</div>
          </div>
        </div>
      </aside>

      <main style={styles.mainContent}>
        <div style={styles.headerProfile}>
          <img src={modelProfileImage} style={styles.mainImage} alt="Main Profile" />
          <div style={{ paddingTop: '20px' }}>
             <h1 style={styles.nameTitle}>{modelNameText.toUpperCase()} {isModelVerified && <span style={styles.verifiedBadge} title="Verified Model">✓</span>}</h1>
             <p style={{ color: '#666', marginTop: '10px', letterSpacing: '1px' }}>{isModelVerified ? "VERIFIED MODEL" : "MODEL PROFILE"}</p>
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
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" style={styles.portfolioImg} alt="p1"/>
                    <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=300&q=80" style={styles.portfolioImg} alt="p2"/>
                    <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80" style={styles.portfolioImg} alt="p3"/>
                 </div>

                 <div>
                    <h2 style={{...styles.sectionTitle, fontSize:'24px'}}>Applications & Bookings</h2>
                    {modelData?.bookings?.length === 0 ? <p>No bookings yet.</p> : modelData?.bookings?.map((booking) => (
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
                      <div style={styles.circleChart}><div style={styles.innerCircle}>{storedModel.fullName ? 100 : 85}%</div></div>
                      <p style={{fontSize:'13px', color:'#666', marginBottom:'20px', lineHeight:'1.5'}}>Complete your profile to unlock more opportunities.</p>
                      <button onClick={() => setActiveTab('account')} style={{background:'#1A1A1A', color:'#FFF', border:'none', padding:'15px 0', width:'100%', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', cursor:'pointer'}}>COMPLETE PROFILE</button>
                  </div>
              </div>
            </div>
        )}



        {activeTab === 'events' && (
            <div>
               <h2 style={styles.sectionTitle}>Public Casting Calls</h2>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                   {modelData?.events?.length === 0 ? <p>No new public events found.</p> : modelData?.events?.map((event) => (
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

        {activeTab === 'account' && (
          <div style={{ background: '#FFF', padding: '40px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', borderRadius: '8px' }}>
            <h2 style={{ ...styles.sectionTitle, fontSize: '28px', marginBottom: '10px' }}>My Account Details</h2>
            <p style={{ color: '#666', marginBottom: '30px', fontSize: '14px' }}>View and update your model profile details.</p>
            
            {/* Verification Request Container */}
            <div style={{ background: '#FFF9E6', border: '1px solid #C5A572', padding: '20px', borderRadius: '6px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '15px', color: '#1A1A1A', fontWeight: 'bold' }}>Verification Badge</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: '1.4' }}>
                  {isModelVerified 
                    ? "Congratulations! Your profile has been verified by administrators." 
                    : isVerificationPending 
                      ? "Your verification request has been received and is pending administrator review."
                      : "Request a verified badge to show creative clients your identity is fully authenticated."}
                </p>
              </div>
              <div>
                {isModelVerified ? (
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
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="fullName" value={editForm.fullName} onChange={handleEditChange} required />
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
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>PHONE</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="phone" value={editForm.phone} onChange={handleEditChange} required />
                </div>
              </div>

              <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', margin: '20px 0 0 0', borderBottom: '1px solid #EEE', paddingBottom: '10px' }}>Physical Measurements</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>HEIGHT (cm)</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="height" value={editForm.height} onChange={handleEditChange} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>WEIGHT (kg)</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="weight" value={editForm.weight} onChange={handleEditChange} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>WAIST SIZE (cm)</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="waist" value={editForm.waist} onChange={handleEditChange} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', letterSpacing: '0.5px' }}>HIP SIZE (cm)</label>
                  <input style={{ padding: '14px', border: '1px solid #DDD', borderRadius: '4px', outline: 'none', fontSize: '14px' }} name="hip" value={editForm.hip} onChange={handleEditChange} required />
                </div>
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

export default ModelDashboard;