import React, { useState } from "react";
import FaceVerification from "../components/FaceVerification";
import "../styles/modelRegister.css";

const ModelForm = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({});
  const [selfie, setSelfie] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selfie) {
      alert("Please complete face verification");
      return;
    }

    console.log("FORM DATA:", form);
    console.log("SELFIE:", selfie);

    alert("Registration Complete ✅");
  };

  return (
    <div className="main-container">

      {/* LEFT SIDEBAR */}
      <div className="sidebar">
        <h3 className="logo">ModelNext</h3>

        <p className={step === 1 ? "active" : ""}>
          Basic Info
          <span>Personal Details</span>
        </p>

        <p className={step === 2 ? "active" : ""}>
          Physical
          <span>Your Measurements</span>
        </p>

        <p className={step === 3 ? "active" : ""}>
          Portfolio
          <span>Upload Images</span>
        </p>

        <p className={step === 4 ? "active" : ""}>
          Social
          <span>Connect Profiles</span>
        </p>

        <p className={step === 5 ? "active" : ""}>
          Verification
          <span>Secure Account</span>
        </p>
      </div>

      {/* RIGHT SIDE */}
      <div className="form-box">
        <form onSubmit={handleSubmit}>

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <h2>Basic Information</h2>
              <p className="subtitle">
                Start by telling us the essentials.
              </p>

              <input
                name="name"
                placeholder="Full Name"
                onChange={handleChange}
              />

              <input
                type="date"
                name="dob"
                onChange={handleChange}
              />

              <input
                name="email"
                placeholder="Email Address"
                onChange={handleChange}
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                onChange={handleChange}
              />

              <button type="button" onClick={() => setStep(2)}>
                Next Step →
              </button>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <h2>Physical Attributes</h2>

              <input name="height" placeholder="Height (cm)" onChange={handleChange} />
              <input name="weight" placeholder="Weight (kg)" onChange={handleChange} />

              <div className="btn-group">
                <button type="button" onClick={() => setStep(1)}>← Back</button>
                <button type="button" onClick={() => setStep(3)}>Next →</button>
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <h2>Portfolio Setup</h2>

              <p className="subtitle">Upload your images (max 6)</p>

              <input type="file" multiple />

              <div className="btn-group">
                <button type="button" onClick={() => setStep(2)}>← Back</button>
                <button type="button" onClick={() => setStep(4)}>Next →</button>
              </div>
            </>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <>
              <h2>Social Media</h2>

              <input placeholder="Instagram URL" />
              <input placeholder="Facebook URL" />

              <div className="btn-group">
                <button type="button" onClick={() => setStep(3)}>← Back</button>
                <button type="button" onClick={() => setStep(5)}>Next →</button>
              </div>
            </>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <>
              <h2>Identity Verification</h2>

              <p className="subtitle">
                Complete face verification to continue
              </p>

              {/* FACE TRACKING */}
              <FaceVerification onCapture={setSelfie} />

              <div className="btn-group">
                <button type="button" onClick={() => setStep(4)}>← Back</button>
                <button type="submit">Submit ✔</button>
              </div>
            </>
          )}

        </form>
      </div>
    </div>
  );
};

export default ModelForm;