import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    inviteCode: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const { name, email, password, confirmPassword, inviteCode } = formData;

    if (!name || !email || !password || !inviteCode) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("http://localhost:5000/api/admin/register", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, invitationCode: inviteCode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create administrator account.");

      setSuccess(true);
      setTimeout(() => navigate("/admin"), 1200);
    } catch (err) {
      setError(err.message || "Unable to create administrator account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = {
    container: { display: 'flex', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif" },
    leftPanel: { flex: 1, background: '#1A1A1A', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '50px 10%', position: 'relative' },
    rightPanel: { flex: 1, position: 'relative', display: 'none' }, 
    bgImage: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 },
    logo: { fontFamily: "'Playfair Display', serif", fontSize: '28px', color: '#FFF', position: 'absolute', top: '40px', left: '10%', cursor: 'pointer', fontWeight: '700' },
    title: { fontFamily: "'Playfair Display', serif", fontSize: '42px', color: '#FFF', marginBottom: '15px' },
    subtitle: { color: '#AAA', fontSize: '14px', marginBottom: '30px', lineHeight: '1.6' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px' },
    input: { padding: '14px 18px', background: '#2A2A2A', border: '1px solid #444', color: '#FFF', fontSize: '13px', outline: 'none' },
    button: { padding: '16px', background: 'var(--mn-casper)', border: 'none', color: '#000', fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer', marginTop: '10px' },
    error: { color: '#E57373', fontSize: '13px', background: 'rgba(229, 115, 115, 0.1)', padding: '10px', borderLeft: '3px solid #E57373', marginBottom: '10px' },
    success: { color: '#81C784', fontSize: '13px', background: 'rgba(129, 199, 132, 0.1)', padding: '10px', borderLeft: '3px solid #81C784', marginBottom: '10px' },
    backLink: { color: '#888', fontSize: '13px', cursor: 'pointer', marginTop: '20px', display: 'inline-block' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftPanel}>
        <div style={styles.logo} onClick={() => navigate("/")}>ModelNext</div>
        
        <div style={{maxWidth: '400px', width: '100%', paddingTop: '60px'}}>
          <h1 style={styles.title}>Register Admin</h1>
          <p style={styles.subtitle}>Create a new moderation account. Authorization required.</p>
          
          {success ? (
            <div style={styles.success}>Account created successfully! Redirecting to dashboard...</div>
          ) : (
            <form style={styles.form} onSubmit={handleSubmit}>
              {error && <div style={styles.error}>{error}</div>}
              
              <input 
                style={styles.input}
                placeholder="Full Name *" 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />

              <input 
                style={styles.input}
                placeholder="Email Address *" 
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
              
              <input 
                style={styles.input}
                placeholder="Password *" 
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />

              <input 
                style={styles.input}
                placeholder="Confirm Password *" 
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />

              <input 
                placeholder="Invitation Security Code *" 
                type="password"
                name="inviteCode"
                value={formData.inviteCode}
                onChange={handleInputChange}
                required
                style={{ ...styles.input, border: '1px solid var(--mn-casper)' }}
              />
              
              <button type="submit" style={styles.button} disabled={isSubmitting}>
                {isSubmitting ? "CREATING ACCOUNT..." : "CREATE ADMIN ACCOUNT"}
              </button>
            </form>
          )}

          <div style={styles.backLink} onClick={() => navigate("/login")}>
            Already have an account? <b style={{color: 'var(--mn-casper)', marginLeft: '5px'}}>Log In</b>
          </div>
        </div>
      </div>

      <div style={{flex: 1, position: 'relative'}}>
        <img 
          src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1000&q=80" 
          alt="Register Background" 
          style={styles.bgImage}
        />
      </div>
    </div>
  );
}
