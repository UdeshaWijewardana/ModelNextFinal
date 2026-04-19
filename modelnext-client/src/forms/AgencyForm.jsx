import { useState } from "react";
import "../styles/agencyForm.css";

export default function AgencyForm() {

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
  const handleSubmit = (e) => {
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

    console.log("Agency Data:", form);
    alert("Agency Registered Successfully!");
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