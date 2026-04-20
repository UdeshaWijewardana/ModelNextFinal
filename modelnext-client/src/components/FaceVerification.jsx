import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";

const FaceVerification = ({ onCapture }) => {
  const videoRef = useRef();
  const streamRef = useRef();
  const intervalRef = useRef();

  const initialXRef = useRef(null);

  const [step, setStep] = useState(0);
  const [status, setStatus] = useState({
    center: false,
    left: false,
    right: false,
  });

  const [message, setMessage] = useState("Initializing...");

  useEffect(() => {
    startCamera();
    loadModels();

    return () => {
      clearInterval(intervalRef.current);
      stopCamera();
    };
  }, []);

  // 🎥 START CAMERA
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
  };

  // ❌ STOP CAMERA
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // 🤖 LOAD MODELS
  const loadModels = async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
    setMessage("Look straight");
    detectFace();
  };

  // 🧠 DETECTION LOGIC
  const detectFace = () => {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;

      const detections = await faceapi.detectAllFaces(videoRef.current);

      if (!detections.length) return;

      const detection = detections.reduce((prev, curr) => {
        return curr.box.width * curr.box.height >
          prev.box.width * prev.box.height
          ? curr
          : prev;
      });

      const x = detection.box.x;

      // STEP 1 — LOOK STRAIGHT
      if (step === 0) {
        initialXRef.current = x;
        setStatus((prev) => ({ ...prev, center: true }));
        setMessage("Turn LEFT");
        setStep(1);
        return;
      }

      // STEP 2 — LEFT
      if (step === 1 && x > initialXRef.current + 50) {
        setStatus((prev) => ({ ...prev, left: true }));
        setMessage("Turn RIGHT");
        setStep(2);
        return;
      }

      // STEP 3 — RIGHT
      if (step === 2 && x < initialXRef.current - 50) {
        setStatus((prev) => ({ ...prev, right: true }));
        setMessage("Verification Complete");
        setStep(3);

        captureImage();
        clearInterval(intervalRef.current);
        stopCamera(); // 🔥 AUTO STOP CAMERA
      }
    }, 400);
  };

  // 📸 CAPTURE
  const captureImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    const image = canvas.toDataURL("image/jpeg");
    onCapture(image);
  };

  return (
    <div className="face-box">
      <h3>{message}</h3>

      {/* CAMERA */}
      {step !== 3 && (
        <video
          ref={videoRef}
          autoPlay
          muted
          width="250"
          style={{ transform: "scaleX(-1)" }}
        />
      )}

      {/* STATUS */}
      <div className="status-box">
        <p> {status.center ? "✅" : "⬜"} Look Straight</p>
        <p> {status.left ? "✅" : "⬜"} Turn Left</p>
        <p> {status.right ? "✅" : "⬜"} Turn Right</p>
      </div>

      {/* SUCCESS */}
      {step === 3 && (
        <div className="success-box">
          <h2>✅ Verification Successful</h2>
        </div>
      )}
    </div>
  );
};

export default FaceVerification;