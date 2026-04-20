import React, { useState } from "react";
import "../styles/modelRegister.css";

const ModelForm = () => {
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    fullName: "",
    birthdate: "",
    email: "",
    password: "",
    categories: [],
    idType: "",
  });

  const [portfolio, setPortfolio] = useState([]);
  const [profile, setProfile] = useState(null);

  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);

  const [error, setError] = useState("");

  // INPUT CHANGE
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleProfile = (e) => {
    setProfile(e.target.files[0]);
  };

  const handlePortfolio = (e) => {
    setPortfolio(Array.from(e.target.files));
  };

  const handleIdFront = (e) => setIdFront(e.target.files[0]);
  const handleIdBack = (e) => setIdBack(e.target.files[0]);

  // SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (portfolio.length !== 6) {
      return setError("Upload exactly 6 images");
    }

    if (!profile) {
      return setError("Upload profile image");
    }

    if (!form.idType) {
      return setError("Select ID type");
    }

    if (!idFront) {
      return setError("Upload ID front image");
    }

    if (form.idType !== "passport" && !idBack) {
      return setError("Upload ID back image");
    }

    try {
      const formData = new FormData();

      // TEXT
      Object.keys(form).forEach((key) => {
        formData.append(key, form[key]);
      });

      // FILES
      formData.append("profileImage", profile);
      formData.append("idFront", idFront);

      if (idBack) {
        formData.append("idBack", idBack);
      }

      portfolio.forEach((file) => {
        formData.append("portfolio", file);
      });

      const res = await fetch(
        "http://localhost:5000/api/models/register",
        {
          method: "POST",
          body: formData,
        }
      );

      const text = await res.text();
      console.log("SERVER RESPONSE:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server error ❌");
      }

      if (!res.ok) throw new Error(data.error);

      alert("Registration Successful ✅");

    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong");
    }
  };

  return (
    <div className="main-container">
      <div className="sidebar">
        <h3 className="logo">ModelNext</h3>
        <p className={step === 1 ? "active" : ""}>Basic Info</p>
        <p className={step === 2 ? "active" : ""}>Physical</p>
        <p className={step === 3 ? "active" : ""}>Portfolio</p>
        <p className={step === 4 ? "active" : ""}>Social</p>
        <p className={step === 5 ? "active" : ""}>ID Verification</p>
      </div>

      <div className="form-box">
        <form onSubmit={handleSubmit}>

          {error && <p className="error">{error}</p>}

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <h2>Basic Info</h2>
              <input name="fullName" placeholder="Full Name" onChange={handleChange} />
              <input type="date" name="birthdate" onChange={handleChange} />
              <input name="email" placeholder="Email" onChange={handleChange} />
              <input type="password" name="password" placeholder="Password" onChange={handleChange} />

              <button type="button" onClick={() => setStep(2)}>Next</button>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <h2>Physical</h2>
              <input name="height" placeholder="Height" onChange={handleChange} />
              <input name="weight" placeholder="Weight" onChange={handleChange} />

              <button type="button" onClick={() => setStep(1)}>Back</button>
              <button type="button" onClick={() => setStep(3)}>Next</button>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <h2>Portfolio</h2>

              <p>Upload Profile Image</p>
              <input type="file" onChange={handleProfile} />

              <p>Upload 6 Images</p>
              <input type="file" multiple onChange={handlePortfolio} />

              <button type="button" onClick={() => setStep(2)}>Back</button>
              <button type="button" onClick={() => setStep(4)}>Next</button>
            </>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <>
              <h2>Social</h2>
              <input placeholder="Instagram" />
              <input placeholder="Facebook" />

              <button type="button" onClick={() => setStep(3)}>Back</button>
              <button type="button" onClick={() => setStep(5)}>Next</button>
            </>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <>
              <h2>ID Verification</h2>

              <select name="idType" onChange={handleChange}>
                <option value="">Select ID Type</option>
                <option value="nic">National ID</option>
                <option value="license">Driving License</option>
                <option value="passport">Passport</option>
              </select>

              <p>Upload Front Image</p>
              <input type="file" onChange={handleIdFront} />

              {form.idType !== "passport" && (
                <>
                  <p>Upload Back Image</p>
                  <input type="file" onChange={handleIdBack} />
                </>
              )}

              <button type="button" onClick={() => setStep(4)}>Back</button>
              <button type="submit">Submit</button>
            </>
          )}

        </form>
      </div>
    </div>
  );
};

export default ModelForm;