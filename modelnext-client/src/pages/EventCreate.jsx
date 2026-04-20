import React, { useState } from "react";
import "../styles/EventCreate.css";

const EventCreate = () => {
  const [imagePreview, setImagePreview] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="event-wrapper">

      {/* LEFT IMAGE */}
      <div className="event-left">
        {/* 👇 serve from public */}
        <img src="/assets/hero.jpg" alt="hero" className="hero-img" />

        <div className="overlay">
          <h2>ModelNext</h2>
          <p>The premier network for creative talent.</p>
        </div>
      </div>

      {/* RIGHT FORM */}
      <div className="event-right">
        <div className="event-card">

          <h2>Create Event</h2>
          <p className="subtitle">
            Design your next runway experience.
          </p>

          <div className="form-grid">
            <input placeholder="Event Name" />

            <select>
              <option>Select Event Type</option>
              <option>Runway</option>
              <option>Photoshoot</option>
              <option>Brand Shoot</option>
              <option>Workshop</option>
            </select>

            <input type="datetime-local" />
            <input type="datetime-local" />

            <input placeholder="Location (City / Venue)" />
            <input placeholder="Organizer Name" />
          </div>

          <textarea placeholder="Event Description"></textarea>

          <label className="upload-box">
            <input type="file" hidden onChange={handleImageUpload} />

            {imagePreview ? (
              <img src={imagePreview} alt="preview" />
            ) : (
              <div className="upload-text">
                Upload Event Banner
              </div>
            )}
          </label>

          <button className="submit-btn">Create Event</button>

        </div>
      </div>

    </div>
  );
};

export default EventCreate;