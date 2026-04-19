import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/modelForm.css";

export default function ModelForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    address: "",
    idType: "",
    phone: "",
    birthdate: "",
    location: "",
    gender: "",
    email: "",
    password: "",
    confirmPassword: "",
    categories: []
  });

  const [profile, setProfile] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [error, setError] = useState("");

  const categoriesList = [
    "Bridal",
    "Sports Wear",
    "Swim Wear",
    "Casual",
    "Fashion",
    "Runway"
  ];

  // 🔹 Handle text input
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // 🔹 Handle category select
  const handleCategory = (cat) => {
    if (form.categories.includes(cat)) {
      setForm({
        ...form,
        categories: form.categories.filter(c => c !== cat)
      });
    } else {
      setForm({
        ...form,
        categories: [...form.categories, cat]
      });
    }
  };

  // 🔹 Profile image
  const handleProfile = (e) => {
    const file = e.target.files[0];
    if (file) setProfile(file);
  };

  // 🔹 Portfolio images (max 6)
  const handlePortfolio = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 6) {
      alert("You can upload max 6 images");
      return;
    }
    setPortfolio(files);
  };

  // 🔹 Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // required check
    for (let key in form) {
      if (key !== "categories" && !form[key]) {
        setError("Please fill all required fields");
        return;
      }
    }

    if (!profile) {
      setError("Profile image is required");
      return;
    }

    if (portfolio.length !== 6) {
      setError("You must upload exactly 6 portfolio images");
      return;
    }

    if (form.categories.length === 0) {
      setError("Select at least one category");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const formData = new FormData();
    for (const key in form) {
      if (key === "categories") {
        formData.append(key, JSON.stringify(form[key]));
      } else {
        formData.append(key, form[key]);
      }
    }
    
    formData.append("profileImage", profile);
    portfolio.forEach(file => formData.append("portfolio", file));

    try {
      const res = await fetch("http://localhost:5000/api/models/register", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to register");

      alert("Model Registered Successfully!");
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div className="model-page">

      <div className="model-box">

        <h1>Model Registration</h1>
        <p className="subtitle">Create your model profile</p>

        {error && <p className="error">{error}</p>}

        {/* PROFILE IMAGE */}
        <div className="profile-upload">
          <span>Upload Profile Image *</span>
          <input type="file" onChange={handleProfile} />
        </div>

        <form onSubmit={handleSubmit}>

          <input name="fullName" placeholder="Full Name" onChange={handleChange} />
          <input name="username" placeholder="Username" onChange={handleChange} />
          <input name="address" placeholder="Address" onChange={handleChange} />

          {/* ID TYPE */}
          <select name="idType" onChange={handleChange}>
            <option value="">Select ID Type</option>
            <option value="nic">National ID</option>
            <option value="license">Driving License</option>
            <option value="passport">Passport</option>
          </select>

          <input name="phone" placeholder="Phone Number" onChange={handleChange} />
          <input type="date" name="birthdate" onChange={handleChange} />
          <input name="location" placeholder="Current Location" onChange={handleChange} />

          {/* GENDER */}
          <select name="gender" onChange={handleChange}>
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="transgender">Transgender</option>
          </select>

          <input name="email" placeholder="Email" onChange={handleChange} />

          <input type="password" name="password" placeholder="Password" onChange={handleChange} />
          <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} />

          {/* CATEGORIES */}
          <div className="categories">
            <p>Select Model Type *</p>
            {categoriesList.map(cat => (
              <span
                key={cat}
                className={form.categories.includes(cat) ? "active" : ""}
                onClick={() => handleCategory(cat)}
              >
                {cat}
              </span>
            ))}
          </div>

          {/* PORTFOLIO */}
          <div className="portfolio">
            <p>Upload 6 Images *</p>
            <input type="file" multiple onChange={handlePortfolio} />
          </div>

          <button type="submit">CREATE ACCOUNT</button>

        </form>

      </div>
    </div>
  );
}