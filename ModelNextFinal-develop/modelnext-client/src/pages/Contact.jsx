import React, { useState } from "react";
import Navbar from "../components/Navbar";
import "../styles/Contact.css";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 1200);
  };

  return (
    <div className="contact-page">
      <Navbar />

      <div className="contact-hero">
        <div className="contact-hero-content">
          <h1>Contact <span className="gold-text">Us</span></h1>
          <p>Have a question or want to partner with us? Send us a message and our representatives will reach out.</p>
        </div>
      </div>

      <div className="contact-container">
        <div className="contact-layout">
          {/* CONTACT INFO PANEL */}
          <div className="contact-info-panel">
            <h2>Get In Touch</h2>
            <p className="info-desc">
              Whether you are an aspiring model, a professional photographer, or a luxury brand, we are here to assist.
            </p>

            <div className="info-details">
              <div className="info-item">
                <span className="info-icon">📍</span>
                <div>
                  <h4>Headquarters</h4>
                  <p>12 Rue du Faubourg Saint-Honoré, 75008 Paris, France</p>
                </div>
              </div>
              
              <div className="info-item">
                <span className="info-icon">📞</span>
                <div>
                  <h4>Telephone</h4>
                  <p>+33 (0) 1 40 20 50 50</p>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon">✉️</span>
                <div>
                  <h4>General Inquiries</h4>
                  <p>support@modelnext.com</p>
                </div>
              </div>
            </div>

            <div className="social-links-panel">
              <h4>Follow Our Network</h4>
              <div className="social-icons">
                <span>Instagram</span>
                <span>Vogue</span>
                <span>LinkedIn</span>
              </div>
            </div>
          </div>

          {/* CONTACT FORM PANEL */}
          <div className="contact-form-panel">
            {submitted ? (
              <div className="success-state">
                <div className="success-icon">✓</div>
                <h3>Message Sent Successfully!</h3>
                <p>Thank you for contacting ModelNext. A representative from our Paris atelier will respond to your inquiry shortly.</p>
                <button className="reset-btn" onClick={() => setSubmitted(false)}>Send Another Message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form">
                <h3>Send Us A Message</h3>
                
                <div className="form-group">
                  <label htmlFor="name">Your Name *</label>
                  <input 
                    type="text" 
                    id="name"
                    name="name" 
                    required 
                    value={formData.name} 
                    onChange={handleChange}
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input 
                    type="email" 
                    id="email"
                    name="email" 
                    required 
                    value={formData.email} 
                    onChange={handleChange}
                    placeholder="e.g. john@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Subject</label>
                  <input 
                    type="text" 
                    id="subject"
                    name="subject" 
                    value={formData.subject} 
                    onChange={handleChange}
                    placeholder="e.g. Representation Inquiry"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="message">Message *</label>
                  <textarea 
                    id="message"
                    name="message" 
                    required 
                    rows="5"
                    value={formData.message} 
                    onChange={handleChange}
                    placeholder="Describe your inquiry in detail..."
                  ></textarea>
                </div>

                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? "SENDING..." : "SUBMIT INQUIRY"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
