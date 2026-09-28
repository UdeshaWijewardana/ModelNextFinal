import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/EventCreate.css";

const EventCreate = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  
  // Form State
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("Runway");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    setCurrentUser(user);
    if (user && user.name) {
      setOrganizerName(user.name);
    }
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!eventName || !location || !organizerName || !description) {
      alert("Please fill in all required fields.");
      return;
    }

    const newEvent = {
      _id: Math.random().toString(),
      clientName: organizerName,
      jobType: `${eventType} (${eventName})`,
      date: startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "Upcoming",
      location: location,
      title: eventName,
      description: description,
      image: imagePreview || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80",
      status: 'PENDING',
      organizerRole: currentUser?.role || 'client',
      ownerEmail: currentUser?.email || "sarah@elite.com"
    };

    const pendingEvents = JSON.parse(localStorage.getItem('pendingEvents')) || [];
    localStorage.setItem('pendingEvents', JSON.stringify([...pendingEvents, newEvent]));
    setSuccess(true);
  };

  // 🔴 AUTHORIZATION CHECK: IF MODEL OR NOT LOGGED IN
  const isModel = currentUser?.role === "model";
  const isLoggedIn = !!currentUser;

  if (isLoggedIn && isModel) {
    return (
      <div className="event-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#131313', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif" }}>
        <Navbar />
        <div style={{ background: '#1c1c1c', border: '1px solid rgba(229, 115, 115, 0.3)', padding: '50px', borderRadius: '12px', maxWidth: '600px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ color: '#E57373', fontSize: '28px', textTransform: 'uppercase', marginBottom: '15px', fontWeight: 'bold' }}>Access Denied</h2>
          <p style={{ color: '#aaa', fontSize: '15px', lineHeight: '1.6', marginBottom: '30px' }}>
            Models are not permitted to host or create industry events. Only verified Agencies, Photographers, and Clients are authorized to request event placement.
          </p>
          <button onClick={() => navigate("/events")} style={{ background: 'linear-gradient(135deg, #f2ca50, #d4af37)', color: '#131313', border: 'none', padding: '14px 28px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' }}>
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="event-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#131313', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif" }}>
        <Navbar />
        <div style={{ background: '#1c1c1c', border: '1px solid rgba(242, 202, 80, 0.2)', padding: '50px', borderRadius: '12px', maxWidth: '600px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ color: '#f2ca50', fontSize: '28px', textTransform: 'uppercase', marginBottom: '15px', fontWeight: 'bold' }}>Authentication Required</h2>
          <p style={{ color: '#aaa', fontSize: '15px', lineHeight: '1.6', marginBottom: '30px' }}>
            Please log in or register as an Agency, Photographer, or Client to schedule and host industry events.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button onClick={() => navigate("/login")} style={{ background: 'transparent', border: '1px solid #f2ca50', color: '#f2ca50', padding: '12px 24px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' }}>
              LOGIN
            </button>
            <button onClick={() => navigate("/register")} style={{ background: 'linear-gradient(135deg, #f2ca50, #d4af37)', color: '#131313', border: 'none', padding: '12px 24px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' }}>
              REGISTER
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-wrapper" style={{ minHeight: '100vh', position: 'relative' }}>
      <Navbar />

      {success ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#131313', width: '100%' }}>
          <div style={{ background: '#1c1c1c', border: '1px solid rgba(129, 199, 132, 0.3)', padding: '50px', borderRadius: '12px', maxWidth: '600px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '64px', color: '#81C784', marginBottom: '20px' }}>✓</div>
            <h2 style={{ color: '#81C784', fontSize: '28px', textTransform: 'uppercase', marginBottom: '15px', fontWeight: 'bold' }}>Request Submitted</h2>
            <p style={{ color: '#aaa', fontSize: '15px', lineHeight: '1.6', marginBottom: '30px' }}>
              Your event creation request was successfully received. It is currently in the moderation queue pending manual review and approval by an administrator.
            </p>
            <button onClick={() => navigate("/events")} style={{ background: 'linear-gradient(135deg, #f2ca50, #d4af37)', color: '#131313', border: 'none', padding: '14px 28px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' }}>
              View Events Page
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* LEFT IMAGE */}
          <div className="event-left">
            <img src="https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80" alt="hero" className="hero-img" />
            <div className="overlay">
              <h2>ModelNext</h2>
              <p>The premier network for creative talent.</p>
            </div>
          </div>

          {/* RIGHT FORM */}
          <div className="event-right" style={{ paddingTop: '100px' }}>
            <div className="event-card">
              <h2>Create Event</h2>
              <p className="subtitle">Design your next runway experience.</p>

              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <input 
                    placeholder="Event Name *" 
                    required 
                    value={eventName} 
                    onChange={(e) => setEventName(e.target.value)} 
                  />

                  <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                    <option value="Runway">Runway Show</option>
                    <option value="Photoshoot">Photoshoot</option>
                    <option value="Brand Shoot">Brand Shoot</option>
                    <option value="Workshop">Workshop</option>
                  </select>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#777', fontWeight: 'bold' }}>START DATE & TIME</label>
                    <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#777', fontWeight: 'bold' }}>END DATE & TIME</label>
                    <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>

                  <input 
                    placeholder="Location (City / Venue) *" 
                    required 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)} 
                  />
                  
                  <input 
                    placeholder="Organizer Name *" 
                    required 
                    value={organizerName} 
                    onChange={(e) => setOrganizerName(e.target.value)} 
                  />
                </div>

                <textarea 
                  placeholder="Event Description *" 
                  required 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  style={{ width: '100%', marginTop: '15px' }}
                ></textarea>

                <label className="upload-box" style={{ marginTop: '15px' }}>
                  <input type="file" hidden onChange={handleImageUpload} />
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="upload-text">Upload Event Banner (Optional)</div>
                  )}
                </label>

                <button type="submit" className="submit-btn" style={{ marginTop: '20px' }}>Submit For Approval</button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EventCreate;