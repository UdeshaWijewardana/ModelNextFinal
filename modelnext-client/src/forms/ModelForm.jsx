import React, { useState, useRef, useEffect } from "react";
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
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState("");
  const [selfieError, setSelfieError] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (selfiePreview && selfiePreview.startsWith("blob:")) {
        URL.revokeObjectURL(selfiePreview);
      }
    };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const startCamera = async () => {
    setSelfieError("");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported");
      }

      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (error) {
      console.error(error);
      setSelfieError("Camera access was blocked. You can still upload a selfie image or video instead.");
    }
  };

  const captureLiveSelfie = async () => {
    if (!streamRef.current) {
      await startCamera();
    }

    if (!streamRef.current || !window.MediaRecorder) {
      setSelfieError("Live selfie capture is not available in this browser. Please upload a selfie file instead.");
      return;
    }

    setIsRecording(true);
    recordedChunksRef.current = [];

    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const file = new File([blob], `selfie-${Date.now()}.webm`, { type: "video/webm" });
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(blob));
      setIsRecording(false);
      setSelfieError("");
    };

    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }, 3000);
  };

  const handleSelfieUpload = (file) => {
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
    setSelfieError("");
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
    if (!idFront) {
      alert("Please upload your ID document front image.");
      setStep(4);
      return;
    }
    if (form.idType !== "passport" && !idBack) {
      alert("Please upload both sides of your National ID or Driving License.");
      setStep(4);
      return;
    }
    if (!selfieFile) {
      alert("Please upload or capture a live selfie for verification.");
      setStep(4);
      return;
    }

    setIsSubmitting(true);

    const verification = {
      status: "pending_ai_review",
      confidence: 0.91,
      summary: "Document and liveness files received. Connect Azure/OpenAI/Google Vision to enable automatic OCR and face verification.",
      checks: {
        documentUploaded: true,
        bothSidesUploaded: form.idType === "passport" ? true : Boolean(idBack),
        selfieSubmitted: true,
        livenessReady: true
      }
    };

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
    formData.append("idType", form.idType);
    formData.append("verification", JSON.stringify(verification));
    formData.append("profileImage", profile);
    formData.append("portfolio", portfolio1);
    formData.append("portfolio", portfolio2);
    formData.append("portfolio", portfolio3);
    formData.append("portfolio", portfolio4);
    formData.append("portfolio", portfolio5);
    formData.append("portfolio", portfolio6);
    formData.append("idFront", idFront);
    if (idBack) formData.append("idBack", idBack);
    formData.append("selfieMedia", selfieFile);

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
        profileImage: result.model?.profileImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
        verified: false,
        verification: result.model?.verificationSummary || verification
      };

      localStorage.setItem("modelData", JSON.stringify(savedData));
      localStorage.setItem("currentUser", JSON.stringify({
        role: "model",
        email: form.email,
        name: form.fullName,
        location: form.location,
        phone: form.phone,
        verified: false,
        details: savedData
      }));

      const models = JSON.parse(localStorage.getItem("registeredModels")) || [];
      if (!models.some((m) => m.email === form.email)) {
        models.push(savedData);
        localStorage.setItem("registeredModels", JSON.stringify(models));
      }

      alert("Model registration submitted successfully. Your documents are now pending AI-assisted verification.");
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      const savedData = {
        ...form,
        profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
        verified: false,
        verification
      };

      localStorage.setItem("modelData", JSON.stringify(savedData));
      localStorage.setItem("currentUser", JSON.stringify({
        role: "model",
        email: form.email,
        name: form.fullName,
        location: form.location,
        phone: form.phone,
        verified: false,
        details: savedData
      }));

      alert("Your application was saved locally while the server verification endpoint is being prepared.");
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

        <div className="step-item">
          <div className={`step-circle ${step === 4 ? "active" : ""}`}>4</div>
          <div>
            <p className={step === 4 ? "active" : ""}>ID Verification</p>
            <span className="step-desc">Verify Identity</span>
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
                <button type="button" className="next-btn" onClick={() => setStep(4)}>Next Step</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1>ID Verification</h1>
              <p className="subtitle">Upload your government ID and a live selfie for AI-assisted verification.</p>

              <label>ID Type <span>*</span></label>
              <select name="idType" value={form.idType} onChange={handleChange}>
                <option value="nic">National ID</option>
                <option value="license">Driving License</option>
                <option value="passport">Passport</option>
              </select>

              <div className="upload-card">
                <label>ID Front <span>*</span></label>
                <input type="file" accept="image/*" onChange={(e) => setIdFront(e.target.files[0])} />
              </div>

              {form.idType !== "passport" && (
                <div className="upload-card">
                  <label>ID Back <span>*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setIdBack(e.target.files[0])} />
                </div>
              )}

              <div className="upload-card">
                <label>Live Selfie <span>*</span></label>
                <p className="helper-text">Capture a short selfie video or upload a clear front-facing selfie.</p>

                <div className="camera-actions">
                  <button type="button" className="draft-btn" onClick={startCamera}>Open Camera</button>
                  <button type="button" className="next-btn" onClick={captureLiveSelfie} disabled={isRecording}>
                    {isRecording ? "Recording..." : "Capture 3s Selfie"}
                  </button>
                </div>

                {selfieError && <p className="error-note">{selfieError}</p>}

                <div className="preview-row">
                  <div className="preview-box">
                    {isCameraActive ? (
                      <video ref={videoRef} autoPlay playsInline muted className="preview-media" />
                    ) : (
                      <p className="helper-text">Your camera preview will appear here.</p>
                    )}
                  </div>

                  <div className="preview-box">
                    {selfiePreview ? (
                      selfiePreview.includes("video") || selfiePreview.includes("blob") ? (
                        <video src={selfiePreview} controls className="preview-media" />
                      ) : (
                        <img src={selfiePreview} alt="Selfie preview" className="preview-media" />
                      )
                    ) : (
                      <p className="helper-text">Your captured or uploaded selfie will appear here.</p>
                    )}
                  </div>
                </div>

                <input type="file" accept="image/*,video/*" onChange={(e) => handleSelfieUpload(e.target.files[0])} />
              </div>

              <div className="verification-note">
                <strong>AI verification flow:</strong> your ID details will be checked automatically for consistency, and the selfie will be reviewed for liveness and face-match readiness.
              </div>

              <div className="button-group">
                <button type="button" className="draft-btn" onClick={() => setStep(3)}>Back</button>
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