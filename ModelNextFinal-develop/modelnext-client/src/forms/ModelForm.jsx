import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/modelForm.css";

const ModelForm = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    fullName: "",
    birthdate: "",
    email: "",
    password: "",
    location: "",
    phone: "",
    weight: "",
    height: "",
    waist: "",
    hip: ""
  });

  const [profile, setProfile] = useState(null);
  const [portfolio1, setPortfolio1] = useState(null);
  const [portfolio2, setPortfolio2] = useState(null);
  const [portfolio3, setPortfolio3] = useState(null);
  const [portfolio4, setPortfolio4] = useState(null);
  const [portfolio5, setPortfolio5] = useState(null);
  const [portfolio6, setPortfolio6] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.fullName || !form.email || !form.location || !form.phone || !form.password) {
      alert("Please fill in all basic info fields (Step 1)");
      setStep(1);
      return;
    }
    if (!form.height || !form.weight || !form.waist || !form.hip) {
      alert("Please fill in all physical attribute fields (Step 2)");
      setStep(2);
      return;
    }
    if (!profile || !portfolio1 || !portfolio2 || !portfolio3 || !portfolio4 || !portfolio5 || !portfolio6) {
      alert("Please upload your profile image and all six portfolio images before continuing.");
      setStep(3);
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("fullName", form.fullName);
    formData.append("birthdate", form.birthdate);
    formData.append("email", form.email);
    formData.append("password", form.password);
    formData.append("location", form.location);
    formData.append("phone", form.phone);
    formData.append("weight", form.weight);
    formData.append("height", form.height);
    formData.append("waist", form.waist);
    formData.append("hip", form.hip);
    formData.append("profileImage", profile);
    formData.append("portfolio", portfolio1);
    formData.append("portfolio", portfolio2);
    formData.append("portfolio", portfolio3);
    formData.append("portfolio", portfolio4);
    formData.append("portfolio", portfolio5);
    formData.append("portfolio", portfolio6);

    try {
      const response = await fetch("http://localhost:5000/api/models/register", {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Registration failed");
      }

      const savedData = {
        ...form,
        profileImage: result.model?.profileImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
      };

      localStorage.setItem("modelData", JSON.stringify(savedData));
      localStorage.setItem("currentUser", JSON.stringify({
        role: "model",
        email: form.email,
        name: form.fullName,
        location: form.location,
        phone: form.phone,
        details: savedData
      }));

      const models = JSON.parse(localStorage.getItem("registeredModels")) || [];
      if (!models.some((m) => m.email === form.email)) {
        models.push(savedData);
        localStorage.setItem("registeredModels", JSON.stringify(models));
      }

      alert("Model registered successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      const savedData = {
        ...form,
        profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
      };

      localStorage.setItem("modelData", JSON.stringify(savedData));
      localStorage.setItem("currentUser", JSON.stringify({
        role: "model",
        email: form.email,
        name: form.fullName,
        location: form.location,
        phone: form.phone,
        details: savedData
      }));

      alert("Your application was saved locally.");
      navigate("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="main-container">
      <div className="sidebar">
        <h2 className="logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>ModelNext</h2>

        <div className="step-item">
          <div className={`step-circle ${step === 1 ? "active" : ""}`}>1</div>
          <div>
            <p className={step === 1 ? "active" : ""}>Basic Info</p>
            <span className="step-desc">Personal Details</span>
          </div>
        </div>

        <div className="step-item">
          <div className={`step-circle ${step === 2 ? "active" : ""}`}>2</div>
          <div>
            <p className={step === 2 ? "active" : ""}>Physical Attributes</p>
            <span className="step-desc">Your Measurements</span>
          </div>
        </div>

        <div className="step-item">
          <div className={`step-circle ${step === 3 ? "active" : ""}`}>3</div>
          <div>
            <p className={step === 3 ? "active" : ""}>Portfolio Setup</p>
            <span className="step-desc">Upload Your Work</span>
          </div>
        </div>
      </div>

      <div className="form-box">
        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              <h1>Basic Information</h1>
              <p className="subtitle">Start by telling us the essentials.</p>

              <div className="grid">
                <div>
                  <label>Full Name <span>*</span></label>
                  <input name="fullName" placeholder="Enter your full name" onChange={handleChange} />
                </div>

                <div>
                  <label>Date of Birth <span>*</span></label>
                  <input type="date" name="birthdate" placeholder="mm/dd/yyyy" onChange={handleChange} />
                </div>
              </div>

              <label>Email Address <span>*</span></label>
              <input name="email" placeholder="you@example.com" onChange={handleChange} />

              <label>Password <span>*</span></label>
              <input type="password" name="password" placeholder="Create a strong password" onChange={handleChange} />

              <label>Location <span>*</span></label>
              <input name="location" placeholder="City, Country" onChange={handleChange} />

              <label>Phone <span>*</span></label>
              <input name="phone" placeholder="Your phone number" onChange={handleChange} />

              <div className="button-group">
                <button type="button" className="next-btn" onClick={() => setStep(2)}>Next Step</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1>Physical Attributes</h1>

              <div className="grid">
                <div>
                  <label>Weight (kg) <span>*</span></label>
                  <input name="weight" placeholder="e.g., 60" onChange={handleChange} />
                </div>

                <div>
                  <label>Height (cm) <span>*</span></label>
                  <input name="height" placeholder="e.g., 170" onChange={handleChange} />
                </div>
              </div>

              <div className="grid">
                <div>
                  <label>Waist Size (cm) <span>*</span></label>
                  <input name="waist" placeholder="e.g., 65" onChange={handleChange} />
                </div>

                <div>
                  <label>Hip Size (cm) <span>*</span></label>
                  <input name="hip" placeholder="e.g., 90" onChange={handleChange} />
                </div>
              </div>

              <div className="button-group">
                <button type="button" className="draft-btn" onClick={() => setStep(1)}>Back</button>
                <button type="button" className="next-btn" onClick={() => setStep(3)}>Next Step</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Portfolio</h1>
              <p className="subtitle">Upload your profile image and six portfolio shots.</p>

              <label>Profile Image <span>*</span></label>
              <input type="file" accept="image/*" onChange={(e) => setProfile(e.target.files[0])} />

              <label className="grid-label">Portfolio Images <span>*</span></label>
              <div className="portfolio-grid">
                <div className="grid-item">
                  <label>Image 1 <span>*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setPortfolio1(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 2 <span>*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setPortfolio2(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 3 <span>*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setPortfolio3(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 4 <span>*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setPortfolio4(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 5 <span>*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setPortfolio5(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 6 <span>*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setPortfolio6(e.target.files[0])} />
                </div>
              </div>

              <div className="button-group">
                <button type="button" className="draft-btn" onClick={() => setStep(2)}>Back</button>
                <button type="submit" className="next-btn" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default ModelForm;