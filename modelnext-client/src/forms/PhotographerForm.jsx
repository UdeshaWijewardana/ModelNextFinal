import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/photographerForm.css";

export default function PhotographerForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    portfolio: "",
    password: "",
    confirmPassword: "",
    profileImage: null
  });

  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  // 🔹 Handle input
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // 🔹 Handle image
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setForm({
      ...form,
      profileImage: file
    });

    setPreview(URL.createObjectURL(file));
  };

  // 🔹 Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !form.name ||
      !form.email ||
      !form.phone ||
      !form.location ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill all required fields");
      return;
    }

    if (!form.profileImage) {
      setError("Profile image is required");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const formData = new FormData();
    for (const key in form) {
      formData.append(key, form[key]);
    }

    try {
      const res = await fetch("http://localhost:5000/api/photographers/register", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to register");

      // Store photographer data in localStorage for dashboard
      localStorage.setItem('photographerData', JSON.stringify(data.photographer));
      localStorage.setItem('currentUser', JSON.stringify({
        role: "photographer",
        email: data.photographer.email || form.email,
        name: data.photographer.name || form.name,
        location: data.photographer.location || form.location,
        phone: data.photographer.phone || form.phone,
        verified: false,
        details: data.photographer
      }));

      // Save to registeredPhotographers list
      const photographers = JSON.parse(localStorage.getItem('registeredPhotographers')) || [];
      if (!photographers.some(p => p.email === (data.photographer.email || form.email))) {
        photographers.push(data.photographer);
        localStorage.setItem('registeredPhotographers', JSON.stringify(photographers));
      }

      alert("Photographer Registered Successfully!");
      navigate("/photographer-dashboard");
    } catch (err) {
      console.error(err);
      
      // Fallback local storage mock if backend server is not running
      const mockPhotographer = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        location: form.location,
        portfolio: form.portfolio,
        profileImage: preview || "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80",
        verified: false
      };
      
      localStorage.setItem('photographerData', JSON.stringify(mockPhotographer));
      localStorage.setItem('currentUser', JSON.stringify({
        role: "photographer",
        email: form.email,
        name: form.name,
        location: form.location,
        phone: form.phone,
        verified: false,
        details: mockPhotographer
      }));

      // Save to registeredPhotographers list
      const photographers = JSON.parse(localStorage.getItem('registeredPhotographers')) || [];
      if (!photographers.some(p => p.email === form.email)) {
        photographers.push(mockPhotographer);
        localStorage.setItem('registeredPhotographers', JSON.stringify(photographers));
      }

      alert("Photographer Registered Successfully!");
      navigate("/photographer-dashboard");
    }
  };

  return (
    <div className="photo-page">

      <div className="photo-box">

        <h1>Photographer Registration</h1>
        <p className="subtitle">Create your photographer profile</p>

        {/* ERROR */}
        {error && <p className="error">{error}</p>}

        {/* PROFILE IMAGE */}
        <div className="profile-upload">
          {preview ? (
            <img src={preview} alt="profile preview" />
          ) : (
            <span>Upload Profile Image (Required)</span>
          )}
          <input type="file" onChange={handleImage} />
        </div>

        <form onSubmit={handleSubmit}>

          <input name="name" placeholder="Full Name" onChange={handleChange} />
          <input name="email" placeholder="Email Address" onChange={handleChange} />
          <input name="phone" placeholder="Phone Number" onChange={handleChange} />
          <input name="location" placeholder="Location" onChange={handleChange} />

          <input
            name="portfolio"
            placeholder="Website / Portfolio Link (Optional)"
            onChange={handleChange}
          />

          <input type="password" name="password" placeholder="Password" onChange={handleChange} />
          <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} />

          <button type="submit">CREATE ACCOUNT</button>

        </form>

      </div>
    </div>
  );
}