import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    // 🟢 LOCAL MOCK ADMIN INTERCEPTION
    if (email === "admin@modelnext.com" && password === "admin123") {
      const adminSession = {
        role: "admin",
        email: "admin@modelnext.com",
        name: "System Administrator",
        verified: true
      };
      localStorage.setItem("currentUser", JSON.stringify(adminSession));
      navigate("/admin");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Login failed");

      // Save currentUser session details
      localStorage.setItem("currentUser", JSON.stringify({
        role: data.role,
        email: data.email,
        name: data.name || "User",
        verified: data.verified || false
      }));

      // Route based on role returned by backend
      if (data.role === "model") navigate("/dashboard");
      else if (data.role === "client") navigate("/client-portal");
      else if (data.role === "agency") navigate("/agency-dashboard");
      else if (data.role === "photographer") navigate("/photographer-dashboard");
      else if (data.role === "admin") navigate("/admin");
      else navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  const styles = {
    container: { display: 'flex', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif" },
    leftPanel: { flex: 1, background: '#1A1A1A', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10%', position: 'relative' },
    rightPanel: { flex: 1, position: 'relative', display: 'none' }, // will override with media query if needed, but inline is fine for this split layout
    bgImage: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 },
    logo: { fontFamily: "'Playfair Display', serif", fontSize: '28px', color: '#FFF', position: 'absolute', top: '40px', left: '10%', cursor: 'pointer', fontWeight: '700' },
    title: { fontFamily: "'Playfair Display', serif", fontSize: '48px', color: '#FFF', marginBottom: '15px' },
    subtitle: { color: '#AAA', fontSize: '15px', marginBottom: '40px', lineHeight: '1.6' },
    form: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px' },
    input: { padding: '16px 20px', background: '#2A2A2A', border: '1px solid #444', color: '#FFF', fontSize: '14px', outline: 'none' },
    button: { padding: '18px', background: '#C5A572', border: 'none', color: '#FFF', fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer', marginTop: '10px' },
    error: { color: '#E57373', fontSize: '13px', marginTop: '-10px', background: 'rgba(229, 115, 115, 0.1)', padding: '10px', borderLeft: '3px solid #E57373' },
    registerLink: { color: '#888', fontSize: '13px', cursor: 'pointer', marginTop: '30px', display: 'inline-block' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftPanel}>
        <div style={styles.logo} onClick={() => navigate("/")}>ModelNext</div>
        
        <div style={{maxWidth: '400px', width: '100%'}}>
          <h1 style={styles.title}>Welcome Back</h1>
          <p style={styles.subtitle}>Enter your credentials to access your professional dashboard.</p>
          
          <form style={styles.form} onSubmit={handleLogin}>
            {error && <div style={styles.error}>{error}</div>}
            
            <input 
              style={styles.input}
              placeholder="Email Address" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            
            <input 
              style={styles.input}
              placeholder="Password" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            
            <button type="submit" style={styles.button}>LOGIN</button>
          </form>

          <div style={styles.registerLink} onClick={() => navigate("/role")}>
            Don't have an account? <b style={{color: '#C5A572', marginLeft: '5px'}}>Join the Network</b>
          </div>
        </div>
      </div>

      <div style={{flex: 1, position: 'relative'}}>
        <img 
          src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80" 
          alt="Login Background" 
          style={styles.bgImage}
        />
      </div>
    </div>
  );
}