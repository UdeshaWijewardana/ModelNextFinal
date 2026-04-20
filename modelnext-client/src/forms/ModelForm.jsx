import React, { useState } from "react";
import "../styles/modelForm.css";

const ModelForm = () => {
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
    hip: "",
    idType: "nic"
  });

  const [profile, setProfile] = useState(null);
  const [portfolio1, setPortfolio1] = useState(null);
  const [portfolio2, setPortfolio2] = useState(null);
  const [portfolio3, setPortfolio3] = useState(null);
  const [portfolio4, setPortfolio4] = useState(null);
  const [portfolio5, setPortfolio5] = useState(null);
  const [portfolio6, setPortfolio6] = useState(null);
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="main-container">

      {/* SIDEBAR */}
      <div className="sidebar">
        <h2 className="logo">ModelNext</h2>

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

        <div className="step-item">
          <div className={`step-circle ${step === 4 ? "active" : ""}`}>4</div>
          <div>
            <p className={step === 4 ? "active" : ""}>ID Verification</p>
            <span className="step-desc">Verify Identity</span>
          </div>
        </div>
      </div>

      {/* FORM AREA */}
      <div className="form-box">
        <form>

          {/* STEP 1 */}
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

          {/* STEP 2 */}
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
                <button className="draft-btn" onClick={() => setStep(1)}>Back</button>
                <button className="next-btn" onClick={() => setStep(3)}>Next Step</button>
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <h1>Portfolio</h1>
              <p className="subtitle">Upload your profile image and 6 portfolio shots.</p>

              <label>Profile Image <span>*</span></label>
              <input type="file" onChange={(e) => setProfile(e.target.files[0])} />

              <label className="grid-label">Portfolio Images <span>*</span></label>
              <div className="portfolio-grid">
                <div className="grid-item">
                  <label>Image 1 <span>*</span></label>
                  <input type="file" onChange={(e) => setPortfolio1(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 2 <span>*</span></label>
                  <input type="file" onChange={(e) => setPortfolio2(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 3 <span>*</span></label>
                  <input type="file" onChange={(e) => setPortfolio3(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 4 <span>*</span></label>
                  <input type="file" onChange={(e) => setPortfolio4(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 5 <span>*</span></label>
                  <input type="file" onChange={(e) => setPortfolio5(e.target.files[0])} />
                </div>

                <div className="grid-item">
                  <label>Image 6 <span>*</span></label>
                  <input type="file" onChange={(e) => setPortfolio6(e.target.files[0])} />
                </div>
              </div>

              <div className="button-group">
                <button className="draft-btn" onClick={() => setStep(2)}>Back</button>
                <button className="next-btn" onClick={() => setStep(4)}>Next Step</button>
              </div>
            </>
          )}

          {/* STEP 4 (ID) */}
          {step === 4 && (
            <>
              <h1>ID Verification</h1>

              <label>ID Type <span>*</span></label>
              <select name="idType" onChange={handleChange}>
                <option value="nic">National ID</option>
                <option value="license">Driving License</option>
                <option value="passport">Passport</option>
              </select>

              <label>ID Front <span>*</span></label>
              <input type="file" onChange={(e) => setIdFront(e.target.files[0])} />

              {form.idType !== "passport" && (
                <>
                  <label>ID Back <span>*</span></label>
                  <input type="file" onChange={(e) => setIdBack(e.target.files[0])} />
                </>
              )}

              <div className="button-group">
                <button className="draft-btn" onClick={() => setStep(3)}>Back</button>
                <button type="submit" className="next-btn">Submit Application</button>
              </div>
            </>
          )}

        </form>
      </div>
    </div>
  );
};

export default ModelForm;