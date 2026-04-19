import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '' });
  
  // ✅ FIXED CLIENT ID (Must match the ID in your seed.js file)
  const CLIENT_ID = "65ca10000000000000000002"; 

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = () => {
    fetch(`http://localhost:5000/api/dashboard/client/${CLIENT_ID}`)
      .then(res => res.json())
      .then(data => { setClientData(data); setLoading(false); })
      .catch(err => console.error("Error:", err));
  };

  const handleCreateEvent = async (e) => {
      e.preventDefault();
      await fetch('http://localhost:5000/api/dashboard/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              clientName: clientData.profile.name,
              jobType: newEvent.title,
              date: newEvent.date,
              modelId: null, // Public Event
              isEvent: true,
              status: 'NEW'
          })
      });
      setShowModal(false); 
      setNewEvent({ title: '', date: '' });
      fetchClientData(); 
      alert("Event Created!");
  };

  // ✅ DELETE EVENT FUNCTION
  const handleDeleteEvent = async (eventId) => {
      if(!window.confirm("Are you sure you want to delete this event?")) return;

      // 1. Optimistic Update: Remove from UI instantly
      setClientData(prev => ({
          ...prev,
          events: prev.events.filter(e => e._id !== eventId)
      }));

      // 2. Send Delete Request to Server
      await fetch(`http://localhost:5000/api/dashboard/booking/${eventId}`, {
          method: 'DELETE'
      });
  };

  // ✅ INSTANT APPROVAL/DECLINE FUNCTION
  const handleReview = async (bookingId, decision) => {
      // 1. Optimistic Update: Remove from Pending list instantly
      setClientData(prev => ({
          ...prev,
          applications: prev.applications.filter(app => app._id !== bookingId)
      }));

      // 2. Send Update to Server
      try {
        await fetch(`http://localhost:5000/api/dashboard/booking/${bookingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: decision })
        });
      } catch (error) { console.error("Failed to update status", error); }
  };

  if (loading) return <div style={{padding:'50px'}}>Loading...</div>;

  // --- STYLES ---
  const styles = {
    container: { display: 'flex', height: '100vh', background: '#F9F5F0', fontFamily: "'Montserrat', sans-serif" },
    sidebar: { width: '250px', background: '#FFF', padding: '30px', borderRight: '1px solid #EAEAEA', display: 'flex', flexDirection: 'column' },
    main: { flex: 1, padding: '50px', overflowY: 'auto' },
    sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: '28px', marginBottom: '20px' },
    card: { background: '#FFF', padding: '25px', marginBottom: '15px', border: '1px solid #EAEAEA', borderRadius: '4px', display:'flex', justifyContent:'space-between', alignItems:'center' },
    pendingCard: { borderLeft: '5px solid #F57F17' },
    // Styling for the delete button (Trash Icon)
    deleteBtn: { background: 'none', border: 'none', color: '#FF5252', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginLeft:'15px', display: 'flex', alignItems: 'center', gap: '5px' }
  };

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 'bold', marginBottom: '40px' }}>ModelNext</div>
        <div style={{ padding: '10px', background: '#EEE', borderRadius: '5px', fontWeight: '600' }}>Dashboard</div>
        
        {/* ✅ FIXED LOGOUT BUTTON */}
        <div 
          style={{ marginTop: 'auto', cursor: 'pointer', color: '#666' }} 
          onClick={() => { 
            localStorage.clear(); 
            navigate('/'); 
          }}
        >
          Logout
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '42px', margin: 0 }}>Client Portal</h1>
            <button className="btn-gold" onClick={() => setShowModal(true)}>+ CREATE EVENT</button>
        </div>

        {/* --- PENDING APPROVALS SECTION --- */}
        <h2 style={styles.sectionTitle}>Pending Approvals</h2>
        {clientData.applications.length === 0 ? (
            <p style={{ color: '#999', marginBottom: '40px' }}>No pending applications.</p>
        ) : (
            <div style={{ marginBottom: '50px' }}>
                {clientData.applications.map(app => (
                    <div key={app._id} style={{ ...styles.card, ...styles.pendingCard }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            {app.modelId && <img src={app.modelId.profileImage} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} alt="model" />}
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                                    {app.modelId ? app.modelId.name : 'Unknown Model'}
                                </div>
                                <div style={{ fontSize: '13px', color: '#666' }}>Applied for: {app.jobType}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-gold" onClick={() => handleReview(app._id, 'CONFIRMED')}>APPROVE</button>
                            <button className="btn-outline" onClick={() => handleReview(app._id, 'DECLINED')}>DECLINE</button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- ACTIVE EVENTS SECTION --- */}
        <h2 style={styles.sectionTitle}>My Active Events</h2>
        {clientData.events.map(event => (
            <div key={event._id} style={styles.card}>
                <div>
                    <div style={{ fontWeight: 'bold' }}>{event.jobType}</div>
                    <div style={{ fontSize: '13px', color: '#666' }}>{event.date}</div>
                </div>
                <div style={{display:'flex', alignItems:'center'}}>
                    <span style={{ fontSize: '11px', background: '#EEE', padding: '5px 10px', borderRadius: '4px' }}>PUBLIC LISTING</span>
                    
                    {/* ✅ DELETE BUTTON */}
                    <button style={styles.deleteBtn} onClick={() => handleDeleteEvent(event._id)}>
                        <i className="fa-solid fa-trash"></i> DELETE
                    </button>
                </div>
            </div>
        ))}
      </main>

      {/* CREATE EVENT MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#FFF', padding: '40px', width: '400px', borderRadius: '8px' }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", marginTop: 0 }}>Create Event</h2>
                <form onSubmit={handleCreateEvent}>
                    <input type="text" placeholder="Event Name" required value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '15px' }} />
                    <input type="text" placeholder="Date" required value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '20px' }} />
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => setShowModal(false)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
                        <button type="submit" className="btn-gold" style={{ flex: 1 }}>Publish</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;