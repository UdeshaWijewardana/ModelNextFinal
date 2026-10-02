import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import WebcamTest from "../components/WebcamTest";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityCheck, setIdentityCheck] = useState(null);
  const [identityError, setIdentityError] = useState("");
  const [idFrontPreview, setIdFrontPreview] = useState("");
  const [livenessSession, setLivenessSession] = useState(null);
  const [livenessCompleted, setLivenessCompleted] = useState(false);
  const [livenessError, setLivenessError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    if (!idFront) {
      setIdFrontPreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(idFront);
    setIdFrontPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [idFront]);

  const handleChange = (e) => {
    setForm((previous) => ({ ...previous, [e.target.name]: e.target.value }));
    setValidationErrors((previous) => ({ ...previous, [e.target.name]: "" }));
    setSubmissionError("");
    if (["fullName", "birthdate", "idType"].includes(e.target.name)) {
      setIdentityVerified(false);
      setIdentityCheck(null);
      setIdentityError("");
      setLivenessSession(null);
      setLivenessCompleted(false);
      setLivenessError("");
    }
  };

  const getStepValidationErrors = (stepNumber) => {
    const errors = {};
    if (stepNumber === 1) {
      ["fullName", "birthdate", "email", "password", "location", "phone"].forEach((field) => {
        if (!String(form[field] || "").trim()) errors[field] = "This field is required.";
      });
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errors.email = "Enter a valid email address.";
      }
    }
    if (stepNumber === 2) {
      ["weight", "height", "waist", "hip"].forEach((field) => {
        const value = Number(form[field]);
        if (!Number.isFinite(value) || value <= 0) errors[field] = "Enter a number greater than 0.";
      });
    }
    if (stepNumber === 3 && (!profile || !portfolio1 || !portfolio2 || !portfolio3 || !portfolio4 || !portfolio5 || !portfolio6)) {
      errors.portfolio = "Upload a profile image and all six portfolio images to continue.";
    }
    return errors;
  };

  const continueFromStep = (stepNumber, nextStep) => {
    const errors = getStepValidationErrors(stepNumber);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStep(nextStep);
  };

  const handleIdFrontChange = (file) => {
    setIdFront(file || null);
    setIdentityVerified(false);
    setIdentityCheck(null);
    setIdentityError("");
    setLivenessSession(null);
    setLivenessCompleted(false);
    setLivenessError("");
  };

  const beginLiveness = async () => {
    if (!identityVerified) {
      setIdentityError("Verify your identity document before continuing.");
      return;
    }
    if (!idFront || (form.idType !== "passport" && !idBack)) {
      setIdentityError("Upload the required sides of your identity document before continuing.");
      return;
    }

    setIsVerifying(true);
    setLivenessError("");
    try {
      const response = await fetch("http://localhost:5000/api/models/liveness/start", { method: "POST" });
      const session = await response.json();
      if (!response.ok) throw new Error(session.error || "Could not start liveness verification.");
      setLivenessSession(session);
      setLivenessCompleted(false);
      setStep(5);
    } catch (error) {
      setLivenessError(error.message || "Could not start liveness verification. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const completeLivenessSession = async () => {
    if (!livenessSession) return;
    setLivenessError("");
    try {
      const response = await fetch("http://localhost:5000/api/models/liveness/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId: livenessSession.verificationId,
          attemptId: livenessSession.attemptId
        })
      });
      const result = await response.json();
      if (!response.ok) {
        const error = new Error(result.error || "Could not confirm liveness verification.");
        error.code = result.code;
        throw error;
      }
      setLivenessCompleted(true);
    } catch (error) {
      setLivenessCompleted(false);
      setLivenessError(error.message || "Could not confirm liveness verification. Please retry.");
      if (error.code?.startsWith("LIVENESS_SESSION")) setLivenessSession(null);
      throw error;
    }
  };

  const handleVerifyDocument = async () => {
    if (!form.fullName || !form.birthdate || !form.idType || !idFront) {
      setIdentityError("Enter your name and date of birth, then upload the front of your identity document.");
      return;
    }

    setIsVerifying(true);
    setIdentityVerified(false);
    setIdentityCheck(null);
    setIdentityError("");

    const verificationData = new FormData();
    verificationData.append("fullName", form.fullName);
    verificationData.append("birthdate", form.birthdate);
    verificationData.append("idType", form.idType);
    verificationData.append("idFront", idFront);

    try {
      const response = await fetch("http://localhost:5000/api/models/verify-identity", {
        method: "POST",
        body: verificationData
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Identity verification failed.");
      }

      setIdentityCheck(result);
      setIdentityVerified(Boolean(
        result.verified && result.checks?.nameMatch && result.checks?.dateOfBirthMatch
      ));
      if (!result.verified) {
        setIdentityError(result.message || "Identity verification failed.");
      }
    } catch (error) {
      setIdentityError(error.message || "Could not verify this document.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const stepNumber of [1, 2, 3]) {
      const errors = getStepValidationErrors(stepNumber);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setStep(stepNumber);
        return;
      }
    }
    if (!idFront) {
      setIdentityError("Upload your ID document front image.");
      setStep(4);
      return;
    }
    if (form.idType !== "passport" && !idBack) {
      setIdentityError("Upload both sides of your National ID or Driving License.");
      setStep(4);
      return;
    }
    if (!identityVerified) {
      setIdentityError("Verify your identity document before submitting the application.");
      setStep(4);
      return;
    }
    if (!livenessCompleted || !livenessSession) {
      setLivenessError("Please complete liveness verification before submitting your registration.");
      setStep(5);
      return;
    }
    setIsSubmitting(true);
    setSubmissionError("");

    const formData = new FormData();
    formData.append("fullName", form.fullName.trim());
    formData.append("birthdate", form.birthdate);
    formData.append("email", form.email.trim());
    formData.append("password", form.password);
    formData.append("location", form.location.trim());
    formData.append("phone", form.phone.trim());
    formData.append("weight", form.weight);
    formData.append("height", form.height);
    formData.append("waist", form.waist);
    formData.append("hip", form.hip);
    formData.append("idType", form.idType);
    formData.append("livenessVerificationId", livenessSession.verificationId);
    formData.append("livenessAttemptId", livenessSession.attemptId);
    formData.append("profileImage", profile);
    formData.append("portfolio", portfolio1);
    formData.append("portfolio", portfolio2);
    formData.append("portfolio", portfolio3);
    formData.append("portfolio", portfolio4);
    formData.append("portfolio", portfolio5);
    formData.append("portfolio", portfolio6);
    formData.append("idFront", idFront);
    if (idBack) formData.append("idBack", idBack);

    try {
      const response = await fetch("http://localhost:5000/api/models/register", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      const result = await response.json();

      if (!response.ok) {
        const error = new Error(result.error || "Registration failed");
        error.payload = result;
        throw error;
      }

      navigate("/dashboard", { state: { registrationSubmitted: true } });
    } catch (error) {
      console.error(error);
      if (error.payload?.code?.startsWith("LIVENESS_SESSION")) {
        setLivenessCompleted(false);
        setLivenessSession(null);
        setStep(4);
        const message = "Your liveness session expired or is no longer valid. Please verify again.";
        setLivenessError(message);
        setIdentityError(message);
      } else {
        setIdentityVerified(false);
        setIdentityCheck(error.payload || null);
        setIdentityError(error.message || "Registration failed. Please try again.");
      }
      setSubmissionError(error.message || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`main-container ${step >= 4 ? "registration-verification-flow" : ""} ${step === 5 ? "registration-liveness" : ""}`}>
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

        <div className="step-item">
          <div className={`step-circle ${step === 4 ? "active" : ""}`}>4</div>
          <div>
            <p className={step === 4 ? "active" : ""}>ID Verification</p>
            <span className="step-desc">Verify Identity</span>
          </div>
        </div>
        <div className="step-item">
          <div className={`step-circle ${step === 5 ? "active" : ""}`}>5</div>
          <div>
            <p className={step === 5 ? "active" : ""}>Liveness</p>
            <span className="step-desc">Verify presence</span>
          </div>
        </div>
        <div className="step-item">
          <div className={`step-circle ${step === 6 ? "active" : ""}`}>6</div>
          <div>
            <p className={step === 6 ? "active" : ""}>Final Review</p>
            <span className="step-desc">Submit application</span>
          </div>
        </div>
      </div>

      <div className="form-box">
        <form className={step === 5 ? "registration-liveness-form" : ""} onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              <h1>Basic Information</h1>
              <p className="subtitle">Start by telling us the essentials.</p>

              <div className="grid">
                <div>
                  <label>Full Name <span>*</span></label>
                  <input name="fullName" value={form.fullName} placeholder="Enter your full name" onChange={handleChange} required aria-invalid={Boolean(validationErrors.fullName)} />
                  {validationErrors.fullName && <p className="error-note" role="alert">{validationErrors.fullName}</p>}
                </div>

                <div>
                  <label>Date of Birth <span>*</span></label>
                  <input type="date" name="birthdate" value={form.birthdate} onChange={handleChange} required aria-invalid={Boolean(validationErrors.birthdate)} />
                  {validationErrors.birthdate && <p className="error-note" role="alert">{validationErrors.birthdate}</p>}
                </div>
              </div>

              <label>Email Address <span>*</span></label>
              <input type="email" name="email" value={form.email} placeholder="you@example.com" onChange={handleChange} required aria-invalid={Boolean(validationErrors.email)} />
              {validationErrors.email && <p className="error-note" role="alert">{validationErrors.email}</p>}

              <label>Password <span>*</span></label>
              <input type="password" name="password" value={form.password} placeholder="Create a strong password" onChange={handleChange} required aria-invalid={Boolean(validationErrors.password)} />
              {validationErrors.password && <p className="error-note" role="alert">{validationErrors.password}</p>}

              <label>Location <span>*</span></label>
              <input name="location" value={form.location} placeholder="City, Country" onChange={handleChange} required aria-invalid={Boolean(validationErrors.location)} />
              {validationErrors.location && <p className="error-note" role="alert">{validationErrors.location}</p>}

              <label>Phone <span>*</span></label>
              <input name="phone" value={form.phone} placeholder="Your phone number" onChange={handleChange} required aria-invalid={Boolean(validationErrors.phone)} />
              {validationErrors.phone && <p className="error-note" role="alert">{validationErrors.phone}</p>}

              <div className="button-group">
                <button type="button" className="next-btn" onClick={() => continueFromStep(1, 2)}>Next Step</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1>Physical Attributes</h1>

              <div className="grid">
                <div>
                  <label>Weight (kg) <span>*</span></label>
                  <input type="number" min="0" step="any" name="weight" value={form.weight} placeholder="e.g., 60" onChange={handleChange} required aria-invalid={Boolean(validationErrors.weight)} />
                  {validationErrors.weight && <p className="error-note" role="alert">{validationErrors.weight}</p>}
                </div>

                <div>
                  <label>Height (cm) <span>*</span></label>
                  <input type="number" min="0" step="any" name="height" value={form.height} placeholder="e.g., 170" onChange={handleChange} required aria-invalid={Boolean(validationErrors.height)} />
                  {validationErrors.height && <p className="error-note" role="alert">{validationErrors.height}</p>}
                </div>
              </div>

              <div className="grid">
                <div>
                  <label>Waist Size (cm) <span>*</span></label>
                  <input type="number" min="0" step="any" name="waist" value={form.waist} placeholder="e.g., 65" onChange={handleChange} required aria-invalid={Boolean(validationErrors.waist)} />
                  {validationErrors.waist && <p className="error-note" role="alert">{validationErrors.waist}</p>}
                </div>

                <div>
                  <label>Hip Size (cm) <span>*</span></label>
                  <input type="number" min="0" step="any" name="hip" value={form.hip} placeholder="e.g., 90" onChange={handleChange} required aria-invalid={Boolean(validationErrors.hip)} />
                  {validationErrors.hip && <p className="error-note" role="alert">{validationErrors.hip}</p>}
                </div>
              </div>

              <div className="button-group">
                <button type="button" className="draft-btn" onClick={() => setStep(1)}>Back</button>
                <button type="button" className="next-btn" onClick={() => continueFromStep(2, 3)}>Next Step</button>
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
              {validationErrors.portfolio && <p className="error-note" role="alert">{validationErrors.portfolio}</p>}

              <div className="button-group">
                <button type="button" className="draft-btn" onClick={() => setStep(2)}>Back</button>
                <button type="button" className="next-btn" onClick={() => continueFromStep(3, 4)}>Next Step</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1>ID Verification</h1>
              <p className="subtitle">Upload your government ID for OCR-assisted identity verification.</p>

              <label>ID Type <span>*</span></label>
              <select name="idType" value={form.idType} onChange={handleChange}>
                <option value="nic">National ID</option>
                <option value="license">Driving License</option>
                <option value="passport">Passport</option>
              </select>

              <div className="upload-card">
                <label>ID Front <span>*</span></label>
                <input type="file" accept="image/*" onChange={(e) => handleIdFrontChange(e.target.files[0])} />
                {idFrontPreview && (
                  <div className="preview-box">
                    <img src={idFrontPreview} alt="Identity document front preview" className="preview-media" />
                  </div>
                )}
                <button
                  type="button"
                  className="next-btn"
                  onClick={handleVerifyDocument}
                  disabled={isVerifying || isSubmitting || !idFront}
                >
                  {isVerifying ? "Verifying document..." : "Verify Document"}
                </button>
                <div className="verification-note" role="status" aria-live="polite">
                  <strong>Identity Document Verification</strong>
                  {!identityCheck && !identityError && (
                    <p>Status: {isVerifying ? "Verifying document..." : "Waiting for verification"}</p>
                  )}
                  {identityCheck?.checks && (
                    <>
                      <p>{identityCheck.checks.nameMatch ? "✓ Name matches" : "✗ Name does not match"}</p>
                      <p>{identityCheck.checks.dateOfBirthMatch ? "✓ Date of birth matches" : "✗ Date of birth does not match"}</p>
                      <strong>{identityVerified ? "Identity document verified" : "Identity verification failed"}</strong>
                    </>
                  )}
                  {identityError && <p className="error-note">{identityError}</p>}
                </div>
              </div>

              {form.idType !== "passport" && (
                <div className="upload-card">
                  <label>ID Back <span>*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setIdBack(e.target.files[0])} />
                </div>
              )}

              <div className="verification-note">
                <strong>Identity check:</strong> registration will repeat document OCR on the server before saving your application.
              </div>

              <div className="button-group">
                <button type="button" className="draft-btn" onClick={() => setStep(3)}>Back</button>
                <button type="button" className="next-btn" onClick={beginLiveness} disabled={isVerifying || isSubmitting}>
                  {isVerifying ? "Preparing liveness..." : "Continue to liveness"}
                </button>
              </div>
              {livenessError && <p className="error-note" role="alert">{livenessError}</p>}
            </>
          )}

          {step === 5 && (
            <>
              <WebcamTest autoStart onVerificationComplete={completeLivenessSession} />
              {livenessError && !livenessSession && <p className="error-note" role="alert">{livenessError}</p>}
              {livenessCompleted && <p className="verification-note" role="status">Liveness session confirmed. Continue when you are ready.</p>}
              <div className="button-group">
                <button type="button" className="draft-btn" onClick={() => setStep(4)}>Back</button>
                <button type="button" className="next-btn" onClick={() => setStep(6)} disabled={!livenessCompleted}>
                  Continue to review
                </button>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h1>Final Review</h1>
              <p className="subtitle">Review your required verification steps before submitting.</p>
              <div className="verification-note" role="status">
                <p><strong>Registration details</strong></p>
                <p>{form.fullName.trim()} · {form.email.trim()} · {form.location.trim()}</p>
                <p>Measurements: {form.weight} kg · {form.height} cm · waist {form.waist} cm · hip {form.hip} cm</p>
                <p>Portfolio: profile image and six portfolio images selected.</p>
                <p>{identityVerified ? "✓ Identity document verified" : "Identity document verification incomplete"}</p>
                <p>{livenessCompleted ? "✓ Liveness verification complete" : "Liveness verification incomplete"}</p>
                <p>Uploaded identity documents will be checked again by the server during registration.</p>
              </div>
              <div className="button-group">
                <button type="button" className="draft-btn" onClick={() => setStep(5)}>Back</button>
                <button type="submit" className="next-btn" disabled={isSubmitting || !livenessCompleted}>
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
              {submissionError && <p className="error-note" role="alert">{submissionError}</p>}
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default ModelForm;
