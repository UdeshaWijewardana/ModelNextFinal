import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/Events.css";

const DEFAULT_EVENTS = [
  {
    _id: "default-1",
    title: "Paris Autumn Haute Couture Week",
    date: "Sept 25 - Oct 03, 2026",
    location: "Grand Palais, Paris",
    status: "Invite Only",
    badgeType: "invite",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
    description: "The peak of luxury fashion showcasing autumn/winter designs from premier fashion houses globally.",
    clientName: "Grand Palais",
    jobType: "Haute Couture Week",
    ownerEmail: "contact@elitemodels.paris"
  },
  {
    _id: "default-2",
    title: "Vanguard New Faces Casting Call",
    date: "July 20, 2026 | 10:00 AM",
    location: "Vanguard Studios, New York",
    status: "Casting Active",
    badgeType: "active",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80",
    description: "Scouting new editorial and runway models. Open walk-in casting. Bring portfolio and composite card.",
    clientName: "Vanguard Studios",
    jobType: "New Faces Casting",
    ownerEmail: "alex@mercerphoto.com"
  },
  {
    _id: "default-3",
    title: "Luminous Eco-Fashion Runway",
    date: "Aug 12, 2026 | 07:00 PM",
    location: "The Green Pavilion, Barcelona",
    status: "RSVP Open",
    badgeType: "rsvp",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=80",
    description: "A sustainable runway celebration presenting eco-friendly couture designs by independent creators.",
    clientName: "Eco-Fashion Corp",
    jobType: "Sustainable Runway",
    ownerEmail: "contact@elitemodels.paris"
  },
  {
    _id: "default-4",
    title: "Cyber-Streetwear Brand Launch Party",
    date: "Oct 15, 2026 | 09:30 PM",
    location: "Neon Atelier, Tokyo",
    status: "Sold Out",
    badgeType: "soldout",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
    description: "Unveiling the next streetwear iteration with visual performance, DJs, and exclusive runway showcases.",
    clientName: "Neon Tokyo",
    jobType: "Streetwear Launch",
    ownerEmail: "alex@mercerphoto.com"
  }
];

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    // Check if approved events are seeded in localStorage, else populate with default events
    let approvedEvents = JSON.parse(localStorage.getItem("approvedEvents"));
    if (!approvedEvents || approvedEvents.length === 0) {
      localStorage.setItem("approvedEvents", JSON.stringify(DEFAULT_EVENTS));
      approvedEvents = DEFAULT_EVENTS;
    }
    setEvents(approvedEvents);

    const user = JSON.parse(localStorage.getItem("currentUser"));
    setCurrentUser(user);

    const reqs = JSON.parse(localStorage.getItem("eventRequests")) || [];
    setRequests(reqs);
  }, []);

  const handleJoinRequest = (event) => {
    if (!currentUser) {
      alert("Please log in to submit a request to join this event.");
      navigate("/login");
      return;
    }

    if (currentUser.role !== "model" && currentUser.role !== "photographer") {
      alert("Only Models and Photographers can submit requests to join events.");
      return;
    }

    const newRequest = {
      id: Math.random().toString(),
      eventId: event._id,
      eventTitle: event.title,
      ownerEmail: event.ownerEmail || "contact@elitemodels.paris",
      requesterName: currentUser.name || "Talent",
      requesterEmail: currentUser.email,
      requesterRole: currentUser.role,
      status: 'PENDING'
    };

    const currentRequests = JSON.parse(localStorage.getItem("eventRequests")) || [];
    const updated = [...currentRequests, newRequest];
    localStorage.setItem("eventRequests", JSON.stringify(updated));
    setRequests(updated);

    alert(`Successfully requested to join "${event.title}"!`);
  };

  const getRequestStatus = (eventId) => {
    if (!currentUser) return null;
    const req = requests.find(r => r.eventId === eventId && r.requesterEmail === currentUser.email);
    return req ? req.status : null;
  };

  const renderRequestButton = (event) => {
    if (!currentUser || (currentUser.role !== "model" && currentUser.role !== "photographer")) {
      return null;
    }

    const status = getRequestStatus(event._id);

    if (status === 'PENDING') {
      return (
        <button className="event-join-btn pending" disabled style={{ background: '#FFF3E0', color: '#E65100', border: '1px solid #FFE0B2', cursor: 'not-allowed', padding: '10px 16px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Requested ⌛
        </button>
      );
    }

    if (status === 'ACCEPTED') {
      return (
        <button className="event-join-btn accepted" disabled style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #C8E6C9', cursor: 'not-allowed', padding: '10px 16px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Joined ✓
        </button>
      );
    }

    if (status === 'REJECTED') {
      return (
        <button className="event-join-btn rejected" disabled style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', cursor: 'not-allowed', padding: '10px 16px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Declined ❌
        </button>
      );
    }

    return (
      <button className="event-join-btn" onClick={() => handleJoinRequest(event)} style={{ background: '#C5A572', color: '#FFF', border: 'none', padding: '10px 16px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Request to Join
      </button>
    );
  };

  return (
    <div className="events-page">
      <Navbar />

      <div className="events-hero">
        <div className="events-hero-content">
          <h1>Industry <span className="gold-text">Events</span></h1>
          <p>Scout and participate in exclusive runway shows, brand launches, and active casting calls.</p>
          <button className="host-btn-hero" onClick={() => navigate("/event/create")}>
            Host New Event
          </button>
        </div>
      </div>

      <div className="events-container">
        <div className="events-grid">
          {events.map((event) => (
            <div key={event._id} className="event-card">
              <div className="event-img-wrapper">
                <img src={event.image} alt={event.title} className="event-img" />
                <span className={`event-badge ${event.badgeType || 'rsvp'}`}>{event.status}</span>
              </div>
              <div className="event-details">
                <div className="event-date">📅 {event.date}</div>
                <h3 className="event-title">{event.title}</h3>
                <div className="event-location">📍 {event.location}</div>
                <p className="event-desc">{event.description}</p>
                <div className="event-actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button className="event-info-btn" style={{ flex: 1 }}>View Details</button>
                  {renderRequestButton(event)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
