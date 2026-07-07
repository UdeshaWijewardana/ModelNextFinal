import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/agencyForm.css";

export default function AgencyForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    agencyName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    businessId: "",
    password: "",
    confirmPassword: "",
    profileImage: null,
    coverImage: null
  });

  const [preview, setPreview] = useState({
    profile: null,
    cover: null
  });

  const [error, setError] = useState("");

  // 🔹 Handle text input
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // 🔹 Handle image upload
  const handleImage = (e) => {
    const { name, files } = e.target;
    const file = files[0];
    if (!file) return;

    setForm({
      ...form,
      [name]: file
    });

    const url = URL.createObjectURL(file);

    if (name === "profileImage") {
      setPreview({ ...preview, profile: url });
    } else {
      setPreview({ ...preview, cover: url });
    }
  };

  // 🔹 Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    // clear previous error
    setError("");

    // required fields check
    if (
      !form.agencyName ||
      !form.ownerName ||
      !form.phone ||
      !form.email ||
      !form.address ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill all required fields");
      return;
    }

    // profile image required
    if (!form.profileImage) {
      setError("Profile image is required");
      return;
    }

    // password match
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const formData = new FormData();
    formData.append("agencyName", form.agencyName);
    formData.append("ownerName", form.ownerName);
    formData.append("phone", form.phone);
    formData.append("email", form.email);
    formData.append("address", form.address);
    if (form.businessId) formData.append("businessId", form.businessId);
    formData.append("password", form.password);
    formData.append("profileImage", form.profileImage);
    if (form.coverImage) formData.append("coverImage", form.coverImage);

    try {
      const res = await fetch("http://localhost:5000/api/agencies/register", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to register agency");
      }

      console.log("Agency Data:", data);
      
      // Store agency data in localStorage for dashboard
      localStorage.setItem('agencyData', JSON.stringify(data.agency));
      localStorage.setItem('currentUser', JSON.stringify({
        role: "agency",
        email: data.agency.email || form.email,
        name: data.agency.agencyName || form.agencyName,
        location: data.agency.address || form.address,
        phone: data.agency.phone || form.phone,
        verified: false,
        details: data.agency
      }));
      // Save to registeredAgencies list
      const agencies = JSON.parse(localStorage.getItem('registeredAgencies')) || [];
      if (!agencies.some(a => a.email === (data.agency.email || form.email))) {
        agencies.push(data.agency);
        localStorage.setItem('registeredAgencies', JSON.stringify(agencies));
      }

      alert("Agency Registered Successfully!");
      
      // Navigate to Agency Dashboard
      navigate("/agency-dashboard");
    } catch (err) {
      console.error(err);
      
      // Fallback local storage mock if backend server is not running
      const mockAgency = {
        agencyName: form.agencyName,
        ownerName: form.ownerName,
        phone: form.phone,
        email: form.email,
        address: form.address,
        businessId: form.businessId,
        profileImage: preview.profile || "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=300&q=80",
        verified: false
      };
      
      localStorage.setItem('agencyData', JSON.stringify(mockAgency));
      localStorage.setItem('currentUser', JSON.stringify({
        role: "agency",
        email: form.email,
        name: form.agencyName,
        location: form.address,
        phone: form.phone,
        verified: false,
        details: mockAgency
      }));

      // Save to registeredAgencies list
      const agencies = JSON.parse(localStorage.getItem('registeredAgencies')) || [];
      if (!agencies.some(a => a.email === form.email)) {
        agencies.push(mockAgency);
        localStorage.setItem('registeredAgencies', JSON.stringify(agencies));
      }

      alert("Agency Registered Successfully!");
      navigate("/agency-dashboard");
    }
  };

  return (
    <div className="agency-page">

      <div className="agency-box">

        <h1>Agency Registration</h1>
        <p className="subtitle">Create your agency profile</p>

        {/* 🔴 ERROR MESSAGE */}
        {error && <p className="error">{error}</p>}

        {/* 🔥 COVER IMAGE (OPTIONAL) */}
        <div className="cover-upload">
          {preview.cover ? (
            <img src={preview.cover} alt="cover preview" />
          ) : (
            <span>Upload Cover Image (Optional)</span>
          )}
          <input type="file" name="coverImage" onChange={handleImage} />
        </div>

        {/* 🔥 PROFILE IMAGE (REQUIRED) */}
        <div className="profile-upload">
          {preview.profile ? (
            <img src={preview.profile} alt="profile preview" />
          ) : (
            <span>Upload Logo (Required)</span>
          )}
          <input type="file" name="profileImage" onChange={handleImage} />
        </div>

        <form onSubmit={handleSubmit}>

          <input name="agencyName" placeholder="Agency Name" onChange={handleChange} />
          <input name="ownerName" placeholder="Owner Name" onChange={handleChange} />
          <input name="phone" placeholder="Contact Number" onChange={handleChange} />
          <input name="email" placeholder="Email Address" onChange={handleChange} />
          <input name="address" placeholder="Office Address" onChange={handleChange} />
          <input name="businessId" placeholder="Business ID (Optional)" onChange={handleChange} />

          <input type="password" name="password" placeholder="Password" onChange={handleChange} />
          <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} />

          <button type="submit">CREATE ACCOUNT</button>

        </form>

      </div>
    </div>
  );
}