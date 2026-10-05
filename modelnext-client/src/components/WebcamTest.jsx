import React, { useEffect, useRef, useState } from "react";
import { FaceDetector, FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import "../styles/WebcamTest.css";

const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_DETECTOR_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const FACE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const DETECTION_INTERVAL_MS = 100;
// EAR hysteresis: <= 0.18 is closed and >= 0.23 is open; the middle band is neutral.
const EYE_CLOSED_THRESHOLD = 0.18;
const EYE_OPEN_THRESHOLD = 0.23;
const EYE_STATE_CONFIRM_FRAMES = 2;
const BLINK_MIN_CLOSED_MS = 80;
const BLINK_MAX_CLOSED_MS = 1500;
// Nose displacement is normalized by eye width; positive image-x displacement is labeled LEFT.
const HEAD_TURN_RATIO_THRESHOLD = 0.12;
const HEAD_POSITION_CONFIRM_FRAMES = 3;

const LEFT_EYE_LANDMARKS = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_LANDMARKS = [362, 385, 387, 263, 373, 380];
const CHALLENGE_TIMEOUT_MS = 120000;
const CHALLENGE_STATES = {
  WAITING_FOR_FACE: "WAITING_FOR_FACE",
  BLINK: "BLINK",
  HEAD_LEFT: "HEAD_LEFT",
  HEAD_RIGHT: "HEAD_RIGHT",
  RETURN_CENTER: "RETURN_CENTER",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR",
};
const CHALLENGE_INSTRUCTIONS = {
  [CHALLENGE_STATES.WAITING_FOR_FACE]: "Please position your face inside the camera view.",
  [CHALLENGE_STATES.BLINK]: "Please blink your eyes",
  [CHALLENGE_STATES.HEAD_LEFT]: "Blink detected ✓ Please turn your head LEFT",
  [CHALLENGE_STATES.HEAD_RIGHT]: "LEFT detected ✓ Please turn your head RIGHT",
  [CHALLENGE_STATES.RETURN_CENTER]: "RIGHT detected ✓ Please look straight at the camera",
  [CHALLENGE_STATES.COMPLETED]: "Liveness verification complete ✓",
};
const CHALLENGE_STEPS = [
  { phase: CHALLENGE_STATES.BLINK, label: "Blink", instruction: "Please blink your eyes", helper: "Close and open your eyes naturally once." },
  { phase: CHALLENGE_STATES.HEAD_LEFT, label: "Turn LEFT", instruction: "Please turn your head LEFT", helper: "Slowly turn your head to the left." },
  { phase: CHALLENGE_STATES.HEAD_RIGHT, label: "Turn RIGHT", instruction: "Please turn your head RIGHT", helper: "Slowly turn your head to the right." },
  { phase: CHALLENGE_STATES.RETURN_CENTER, label: "Look CENTER", instruction: "Please look straight at the camera", helper: "Keep your face centered for a moment." },
];
const SUCCESS_MESSAGES = {
  [CHALLENGE_STATES.HEAD_LEFT]: "✓ Blink detected",
  [CHALLENGE_STATES.HEAD_RIGHT]: "✓ Left movement detected",
  [CHALLENGE_STATES.RETURN_CENTER]: "✓ Right movement detected",
};

function initialChallengeState() {
  return {
    phase: CHALLENGE_STATES.WAITING_FOR_FACE,
    facePresence: "missing",
    errorType: null,
    instruction: CHALLENGE_INSTRUCTIONS[CHALLENGE_STATES.WAITING_FOR_FACE],
  };
}

function transitionChallenge(state, event) {
  if (event.type === "RESET") return initialChallengeState();

  if (event.type === "TIMEOUT") {
    if ([CHALLENGE_STATES.WAITING_FOR_FACE, CHALLENGE_STATES.COMPLETED, CHALLENGE_STATES.ERROR].includes(state.phase)) {
      return state;
    }
    return {
      ...state,
      phase: CHALLENGE_STATES.ERROR,
      errorType: "timeout",
      instruction: "Liveness verification timed out. Please try again.",
    };
  }

  if (event.type === "ERROR") {
    if (state.phase === CHALLENGE_STATES.COMPLETED) return state;
    return {
      ...state,
      phase: CHALLENGE_STATES.ERROR,
      errorType: "error",
      instruction: event.message || "Liveness verification could not continue. Please try again.",
    };
  }

  if (state.phase === CHALLENGE_STATES.COMPLETED || state.phase === CHALLENGE_STATES.ERROR) {
    return state;
  }

  if (event.type === "MULTIPLE_FACES") {
    if (state.facePresence === "multiple") return state;
    return { ...state, facePresence: "multiple", instruction: "Please keep only one face in view." };
  }

  if (event.type === "FACE_LOST") {
    if (state.facePresence === "missing") return state;
    return { ...state, facePresence: "missing", instruction: "Please return your face to the camera." };
  }

  if (event.type === "FACE_READY") {
    if (state.facePresence === "single" && state.phase !== CHALLENGE_STATES.WAITING_FOR_FACE) return state;
    const phase = state.phase === CHALLENGE_STATES.WAITING_FOR_FACE
      ? CHALLENGE_STATES.BLINK
      : state.phase;
    return {
      ...state,
      phase,
      facePresence: "single",
      instruction: CHALLENGE_INSTRUCTIONS[phase],
    };
  }

  if (state.facePresence !== "single") return state;

  if (event.type === "BLINK" && state.phase === CHALLENGE_STATES.BLINK) {
    return {
      ...state,
      phase: CHALLENGE_STATES.HEAD_LEFT,
      instruction: CHALLENGE_INSTRUCTIONS[CHALLENGE_STATES.HEAD_LEFT],
    };
  }

  if (event.type === "HEAD_POSITION") {
    const nextPhase = {
      [CHALLENGE_STATES.HEAD_LEFT]: event.position === "LEFT" ? CHALLENGE_STATES.HEAD_RIGHT : null,
      [CHALLENGE_STATES.HEAD_RIGHT]: event.position === "RIGHT" ? CHALLENGE_STATES.RETURN_CENTER : null,
      [CHALLENGE_STATES.RETURN_CENTER]: event.position === "CENTER" ? CHALLENGE_STATES.COMPLETED : null,
    }[state.phase];

    if (!nextPhase) return state;
    return {
      ...state,
      phase: nextPhase,
      instruction: CHALLENGE_INSTRUCTIONS[nextPhase],
    };
  }

  return state;
}

function challengeProgress(phase) {
  return {
    [CHALLENGE_STATES.WAITING_FOR_FACE]: "Waiting for face",
    [CHALLENGE_STATES.BLINK]: "Step 1 of 4: Blink",
    [CHALLENGE_STATES.HEAD_LEFT]: "Step 2 of 4: Turn LEFT",
    [CHALLENGE_STATES.HEAD_RIGHT]: "Step 3 of 4: Turn RIGHT",
    [CHALLENGE_STATES.RETURN_CENTER]: "Step 4 of 4: Look CENTER",
    [CHALLENGE_STATES.COMPLETED]: "4 of 4 completed ✓",
    [CHALLENGE_STATES.ERROR]: "Challenge stopped",
  }[phase];
}

function landmarkDistance(landmarks, firstIndex, secondIndex) {
  const first = landmarks[firstIndex];
  const second = landmarks[secondIndex];
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function calculateEyeAspectRatio(landmarks, [outer, upperOuter, upperInner, inner, lowerInner, lowerOuter]) {
  const eyeWidth = landmarkDistance(landmarks, outer, inner);
  if (eyeWidth === 0) return 0;

  const verticalOpening = landmarkDistance(landmarks, upperOuter, lowerOuter)
    + landmarkDistance(landmarks, upperInner, lowerInner);

  return verticalOpening / (2 * eyeWidth);
}

function updateBlinkState(landmarks, state, timestamp) {
  const leftEyeRatio = calculateEyeAspectRatio(landmarks, LEFT_EYE_LANDMARKS);
  const rightEyeRatio = calculateEyeAspectRatio(landmarks, RIGHT_EYE_LANDMARKS);
  const bothEyesClosed = leftEyeRatio <= EYE_CLOSED_THRESHOLD
    && rightEyeRatio <= EYE_CLOSED_THRESHOLD;
  const bothEyesOpen = leftEyeRatio >= EYE_OPEN_THRESHOLD
    && rightEyeRatio >= EYE_OPEN_THRESHOLD;

  if (state.phase === "OPEN") {
    state.closedFrames = bothEyesClosed ? state.closedFrames + 1 : 0;

    if (state.closedFrames >= EYE_STATE_CONFIRM_FRAMES) {
      state.phase = "CLOSED";
      state.closedAt = timestamp;
      state.openFrames = 0;
    }

    return false;
  }

  if (state.phase === "REARM") {
    state.openFrames = bothEyesOpen ? state.openFrames + 1 : 0;
    if (state.openFrames >= EYE_STATE_CONFIRM_FRAMES) {
      state.phase = "OPEN";
      state.openFrames = 0;
    }
    return false;
  }

  if (timestamp - state.closedAt > BLINK_MAX_CLOSED_MS) {
    state.phase = "REARM";
    state.closedFrames = 0;
    state.openFrames = 0;
    state.closedAt = null;
    return false;
  }

  state.openFrames = bothEyesOpen ? state.openFrames + 1 : 0;

  if (state.openFrames < EYE_STATE_CONFIRM_FRAMES) {
    return false;
  }

  const closedDuration = timestamp - state.closedAt;
  state.phase = "OPEN";
  state.closedFrames = 0;
  state.openFrames = 0;
  state.closedAt = null;

  return closedDuration >= BLINK_MIN_CLOSED_MS && closedDuration <= BLINK_MAX_CLOSED_MS;
}

function resetBlinkState(state) {
  state.phase = "OPEN";
  state.closedFrames = 0;
  state.openFrames = 0;
  state.closedAt = null;
}

function getHeadPosition(landmarks) {
  const leftEyeCorner = landmarks[33];
  const rightEyeCorner = landmarks[263];
  const nose = landmarks[1];
  const eyeWidth = Math.abs(rightEyeCorner.x - leftEyeCorner.x);

  if (eyeWidth === 0) return "CENTER";

  const eyeCenterX = (leftEyeCorner.x + rightEyeCorner.x) / 2;
  const horizontalRatio = (nose.x - eyeCenterX) / eyeWidth;

  if (horizontalRatio > HEAD_TURN_RATIO_THRESHOLD) return "LEFT";
  if (horizontalRatio < -HEAD_TURN_RATIO_THRESHOLD) return "RIGHT";
  return "CENTER";
}

const WebcamTest = ({ autoStart = false, onVerificationComplete }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraStartInFlightRef = useRef(false);
  const detectorRef = useRef(null);
  const landmarkerRef = useRef(null);
  const visionPromiseRef = useRef(null);
  const detectorPromiseRef = useRef(null);
  const landmarkerPromiseRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const challengeTimeoutRef = useRef(null);
  const transitionTimeoutRef = useRef(null);
  const previousPhaseRef = useRef(CHALLENGE_STATES.WAITING_FOR_FACE);
  const isMountedRef = useRef(false);
  const blinkStateRef = useRef({ phase: "OPEN", closedFrames: 0, openFrames: 0, closedAt: null });
  const blinkCountRef = useRef(0);
  const headPositionCandidateRef = useRef({ position: "WAITING", frames: 0 });
  const [challenge, setChallenge] = useState(initialChallengeState);
  const [successFeedback, setSuccessFeedback] = useState("");
  const challengeRef = useRef(challenge);
  challengeRef.current = challenge;
  const [, setCameraStatus] = useState("Camera not started.");
  const [, setDetectorStatus] = useState("Face detector not loaded.");
  const [, setLandmarkerStatus] = useState("Face landmarker not loaded.");
  const [, setFaceStatus] = useState("Waiting for camera.");
  const [isCameraConnected, setIsCameraConnected] = useState(false);
  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const [isLandmarkerReady, setIsLandmarkerReady] = useState(false);
  const [, setHasFaceLandmarks] = useState(false);
  const [, setBlinkCount] = useState(0);
  const [, setHeadPosition] = useState("WAITING");
  const [isStarting, setIsStarting] = useState(false);
  const [isConfirmingCompletion, setIsConfirmingCompletion] = useState(false);
  const [completionConfirmationError, setCompletionConfirmationError] = useState(null);
  const completionNotifiedRef = useRef(false);
  const confirmCompletionRef = useRef(null);
  const startCameraRef = useRef(null);
  const evidenceCapturesRef = useRef({});

  useEffect(() => {
    isMountedRef.current = true;
    const videoElement = videoRef.current;
    const blinkState = blinkStateRef.current;

    return () => {
      isMountedRef.current = false;
      window.clearTimeout(detectionTimerRef.current);
      window.clearTimeout(challengeTimeoutRef.current);
      window.clearTimeout(transitionTimeoutRef.current);
      challengeTimeoutRef.current = null;
      resetBlinkState(blinkState);
      blinkCountRef.current = 0;
      headPositionCandidateRef.current = { position: "WAITING", frames: 0 };
      detectorRef.current?.close();
      landmarkerRef.current?.close();
      detectorRef.current = null;
      landmarkerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = challenge.phase;

    const feedback = SUCCESS_MESSAGES[challenge.phase];
    if (feedback && previousPhase !== challenge.phase) {
      setSuccessFeedback(feedback);
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = window.setTimeout(() => setSuccessFeedback(""), 900);
    } else if ([CHALLENGE_STATES.ERROR, CHALLENGE_STATES.WAITING_FOR_FACE].includes(challenge.phase)) {
      setSuccessFeedback("");
      window.clearTimeout(transitionTimeoutRef.current);
    }
  }, [challenge.phase]);

  useEffect(() => {
    if (!isCameraConnected || !isDetectorReady || !isLandmarkerReady) {
      return undefined;
    }

    let isCancelled = false;

    const detectFrame = () => {
      if (isCancelled) return;
      if ([CHALLENGE_STATES.COMPLETED, CHALLENGE_STATES.ERROR].includes(challengeRef.current.phase)) return;

      const video = videoRef.current;
      const detector = detectorRef.current;

      if (video && detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const timestamp = performance.now();
          const result = detector.detectForVideo(video, timestamp);
          if (result.detections.length > 1) {
            setFaceStatus("Multiple faces detected");
            dispatchChallenge({ type: "MULTIPLE_FACES" });
            resetBlinkState(blinkStateRef.current);
            headPositionCandidateRef.current = { position: "WAITING", frames: 0 };
            setHeadPosition("WAITING");
            setHasFaceLandmarks(false);
            setLandmarkerStatus("Waiting for one face...");
          } else if (result.detections.length === 0) {
            setFaceStatus("No face detected");
            dispatchChallenge({ type: "FACE_LOST" });
            resetBlinkState(blinkStateRef.current);
            headPositionCandidateRef.current = { position: "WAITING", frames: 0 };
            setHeadPosition("WAITING");
            setHasFaceLandmarks(false);
            setLandmarkerStatus("Waiting for face...");
          } else if (landmarkerRef.current) {
            try {
              const landmarkResult = landmarkerRef.current.detectForVideo(video, timestamp);
              const landmarks = landmarkResult.faceLandmarks[0];
              const landmarksAvailable = Boolean(landmarks?.length);
              setHasFaceLandmarks(landmarksAvailable);
              setFaceStatus(landmarksAvailable ? "Face detected" : "Waiting for face landmarks");
              setLandmarkerStatus(landmarksAvailable ? "Face landmarks ready" : "Waiting for face...");

              if (landmarksAvailable) {
                dispatchChallenge({ type: "FACE_READY" });

                if (challengeRef.current.phase === CHALLENGE_STATES.BLINK
                  && updateBlinkState(landmarks, blinkStateRef.current, timestamp)) {
                  blinkCountRef.current += 1;
                  setBlinkCount(blinkCountRef.current);
                  dispatchChallenge({ type: "BLINK" });
                } else if (challengeRef.current.phase !== CHALLENGE_STATES.BLINK) {
                  resetBlinkState(blinkStateRef.current);
                }

                const candidatePosition = getHeadPosition(landmarks);
                if (headPositionCandidateRef.current.position === candidatePosition) {
                  headPositionCandidateRef.current.frames += 1;
                } else {
                  headPositionCandidateRef.current = { position: candidatePosition, frames: 1 };
                }

                if (headPositionCandidateRef.current.frames >= HEAD_POSITION_CONFIRM_FRAMES) {
                  setHeadPosition((currentPosition) => (
                    currentPosition === candidatePosition ? currentPosition : candidatePosition
                  ));
                  const activePhase = challengeRef.current.phase;
                  if (activePhase === CHALLENGE_STATES.HEAD_LEFT && candidatePosition === "LEFT") {
                    void captureEvidenceFrame("left");
                  } else if (activePhase === CHALLENGE_STATES.HEAD_RIGHT && candidatePosition === "RIGHT") {
                    void captureEvidenceFrame("right");
                  } else if (activePhase === CHALLENGE_STATES.RETURN_CENTER && candidatePosition === "CENTER") {
                    void captureEvidenceFrame("front");
                  }
                  dispatchChallenge({ type: "HEAD_POSITION", position: candidatePosition });
                }
              } else {
                dispatchChallenge({ type: "FACE_LOST" });
                resetBlinkState(blinkStateRef.current);
                headPositionCandidateRef.current = { position: "WAITING", frames: 0 };
                setHeadPosition((currentPosition) => (
                  currentPosition === "WAITING" ? currentPosition : "WAITING"
                ));
              }
            } catch (error) {
              landmarkerRef.current.close();
              landmarkerRef.current = null;
              landmarkerPromiseRef.current = null;
              setIsLandmarkerReady(false);
              setHasFaceLandmarks(false);
              resetBlinkState(blinkStateRef.current);
              headPositionCandidateRef.current = { position: "WAITING", frames: 0 };
              setHeadPosition("WAITING");
              setLandmarkerStatus(`Face landmark detection failed: ${error.message || "Unknown landmark error."}`);
              dispatchChallenge({
                type: "ERROR",
                message: "Face landmark detection failed. Please try again.",
              });
            }
          }
        } catch (error) {
          detector.close();
          detectorRef.current = null;
          detectorPromiseRef.current = null;
          landmarkerRef.current?.close();
          landmarkerRef.current = null;
          landmarkerPromiseRef.current = null;
          setIsDetectorReady(false);
          setIsLandmarkerReady(false);
          setDetectorStatus(`Face detection failed: ${error.message || "Unknown detector error."}`);
          setFaceStatus("Face detection unavailable.");
          setHasFaceLandmarks(false);
          resetBlinkState(blinkStateRef.current);
          headPositionCandidateRef.current = { position: "WAITING", frames: 0 };
          setHeadPosition("WAITING");
          setLandmarkerStatus("Face landmarks unavailable.");
          dispatchChallenge({
            type: "ERROR",
            message: "Face detection failed. Please try again.",
          });
          return;
        }
      }

      detectionTimerRef.current = window.setTimeout(detectFrame, DETECTION_INTERVAL_MS);
    };

    detectFrame();
    return () => {
      isCancelled = true;
      window.clearTimeout(detectionTimerRef.current);
    };
  }, [isCameraConnected, isDetectorReady, isLandmarkerReady, challenge.phase]);

  useEffect(() => {
    const activeStates = [
      CHALLENGE_STATES.BLINK,
      CHALLENGE_STATES.HEAD_LEFT,
      CHALLENGE_STATES.HEAD_RIGHT,
      CHALLENGE_STATES.RETURN_CENTER,
    ];

    if (activeStates.includes(challenge.phase) && challengeTimeoutRef.current === null) {
      challengeTimeoutRef.current = window.setTimeout(() => {
        challengeTimeoutRef.current = null;
        dispatchChallenge({ type: "TIMEOUT" });
      }, CHALLENGE_TIMEOUT_MS);
    } else if ([CHALLENGE_STATES.ERROR, CHALLENGE_STATES.COMPLETED].includes(challenge.phase)) {
      window.clearTimeout(challengeTimeoutRef.current);
      challengeTimeoutRef.current = null;
    }
  }, [challenge.phase]);

  useEffect(() => () => {
    window.clearTimeout(challengeTimeoutRef.current);
    window.clearTimeout(transitionTimeoutRef.current);
  }, []);

  function dispatchChallenge(event) {
    setChallenge((current) => transitionChallenge(current, event));
  }

  function captureEvidenceFrame(view) {
    if (evidenceCapturesRef.current[view]) return evidenceCapturesRef.current[view];

    const capture = new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
        reject(new Error("The camera frame was unavailable for verification evidence."));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("The camera frame could not be prepared for verification evidence."));
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The camera frame could not be captured for verification evidence."));
      }, "image/jpeg", 0.92);
    });

    evidenceCapturesRef.current[view] = capture;
    capture.catch(() => { delete evidenceCapturesRef.current[view]; });
    return capture;
  }

  const getVisionFileset = () => {
    if (!visionPromiseRef.current) {
      visionPromiseRef.current = FilesetResolver.forVisionTasks(VISION_WASM_URL);
    }
    return visionPromiseRef.current;
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraConnected(false);
    setCameraStatus("Camera stopped.");
    setFaceStatus("Waiting for camera.");
    dispatchChallenge({ type: "FACE_LOST" });
    setHasFaceLandmarks(false);
    resetBlinkState(blinkStateRef.current);
    headPositionCandidateRef.current = { position: "WAITING", frames: 0 };
    setHeadPosition("WAITING");
    setLandmarkerStatus((currentStatus) => (
      currentStatus === "Face landmarks ready" || currentStatus === "Waiting for face..."
        ? "Waiting for face..."
        : currentStatus
    ));
  };

  const tryAgain = () => {
    resetBlinkState(blinkStateRef.current);
    blinkCountRef.current = 0;
    headPositionCandidateRef.current = { position: "WAITING", frames: 0 };
    setBlinkCount(0);
    setHeadPosition("WAITING");
    setHasFaceLandmarks(false);
    setSuccessFeedback("");
    evidenceCapturesRef.current = {};
    previousPhaseRef.current = CHALLENGE_STATES.WAITING_FOR_FACE;
    window.clearTimeout(transitionTimeoutRef.current);
    window.clearTimeout(challengeTimeoutRef.current);
    challengeTimeoutRef.current = null;
    dispatchChallenge({ type: "RESET" });

    if (isCameraConnected) {
      if (!detectorRef.current) void initializeDetector();
      if (!landmarkerRef.current) void initializeLandmarker();
    }
  };

  const initializeDetector = async () => {
    if (detectorRef.current || detectorPromiseRef.current) return;

    setDetectorStatus("Loading face detector...");

    const initialization = (async () => {
      const vision = await getVisionFileset();
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL_URL },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });

      if (!isMountedRef.current) {
        detector.close();
        return;
      }

      detectorRef.current = detector;
      setIsDetectorReady(true);
      setDetectorStatus("Face detector ready");
    })();

    detectorPromiseRef.current = initialization;

    try {
      await initialization;
    } catch (error) {
      detectorPromiseRef.current = null;
      visionPromiseRef.current = null;
      if (isMountedRef.current) {
        setIsDetectorReady(false);
        setDetectorStatus(`Could not load face detector: ${error.message || "Unknown loading error."}`);
        dispatchChallenge({ type: "ERROR", message: "We couldn't complete the camera verification." });
      }
    }
  };

  const initializeLandmarker = async () => {
    if (landmarkerRef.current || landmarkerPromiseRef.current) return;

    setLandmarkerStatus("Loading face landmarker...");

    const initialization = (async () => {
      const vision = await getVisionFileset();
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 1,
      });

      if (!isMountedRef.current) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker;
      setIsLandmarkerReady(true);
      setLandmarkerStatus("Waiting for face...");
    })();

    landmarkerPromiseRef.current = initialization;

    try {
      await initialization;
    } catch (error) {
      landmarkerPromiseRef.current = null;
      visionPromiseRef.current = null;
      if (isMountedRef.current) {
        setIsLandmarkerReady(false);
        setLandmarkerStatus(`Could not load face landmarker: ${error.message || "Unknown loading error."}`);
        dispatchChallenge({ type: "ERROR", message: "We couldn't complete the camera verification." });
      }
    }
  };

  const startCamera = async () => {
    if (streamRef.current || cameraStartInFlightRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("Camera access is unavailable in this browser.");
      dispatchChallenge({ type: "ERROR", message: "We couldn't complete the camera verification." });
      return;
    }

    cameraStartInFlightRef.current = true;
    stopCamera();
    setIsStarting(true);
    setCameraStatus("Requesting camera access...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setIsCameraConnected(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus("Camera connected");
      setFaceStatus("Waiting for face detector...");
      void initializeDetector();
      void initializeLandmarker();
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Camera startup failed:", error);

      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraStatus("Camera permission was denied. Allow camera access in your browser and try again.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setCameraStatus("No camera was found. Connect a camera and try again.");
      } else {
        setCameraStatus("Camera could not start.");
      }
      dispatchChallenge({ type: "ERROR", message: "We couldn't complete the camera verification." });
    } finally {
      cameraStartInFlightRef.current = false;
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  };

  startCameraRef.current = startCamera;

  useEffect(() => {
    if (autoStart) void startCameraRef.current?.();
  }, [autoStart]);

  useEffect(() => {
    if (challenge.phase === CHALLENGE_STATES.COMPLETED && !completionNotifiedRef.current) {
      completionNotifiedRef.current = true;
      void confirmCompletionRef.current?.();
    }
    if (challenge.phase === CHALLENGE_STATES.WAITING_FOR_FACE) {
      completionNotifiedRef.current = false;
      setCompletionConfirmationError(null);
    }
  }, [challenge.phase]);

  const confirmCompletion = async () => {
    if (!onVerificationComplete) return;
    setIsConfirmingCompletion(true);
    try {
      const [front, left, right] = await Promise.all([
        evidenceCapturesRef.current.front,
        evidenceCapturesRef.current.left,
        evidenceCapturesRef.current.right,
      ]);
      // Each image is captured from the live stream only after its existing challenge state is confirmed.
      await onVerificationComplete({ front, left, right });
      setCompletionConfirmationError(null);
    } catch (error) {
      setCompletionConfirmationError(error);
    } finally {
      setIsConfirmingCompletion(false);
    }
  };

  confirmCompletionRef.current = confirmCompletion;

  const currentStepIndex = CHALLENGE_STEPS.findIndex((step) => step.phase === challenge.phase);
  const hasActiveFace = challenge.facePresence === "single";
  const isFaceMissing = challenge.facePresence === "missing"
    && ![CHALLENGE_STATES.WAITING_FOR_FACE, CHALLENGE_STATES.COMPLETED, CHALLENGE_STATES.ERROR].includes(challenge.phase);
  const isMultipleFaces = challenge.facePresence === "multiple";
  const isTimedOut = challenge.phase === CHALLENGE_STATES.ERROR && challenge.errorType === "timeout";
  const isError = challenge.phase === CHALLENGE_STATES.ERROR && !isTimedOut;
  const isComplete = challenge.phase === CHALLENGE_STATES.COMPLETED;
  const currentTitle = isComplete
    ? "Liveness verified ✓"
    : isTimedOut
      ? "Liveness verification timed out."
      : isError
        ? "We couldn't complete camera verification."
        : isMultipleFaces
          ? "One face at a time"
          : isFaceMissing
            ? "Face not detected"
            : challenge.phase === CHALLENGE_STATES.WAITING_FOR_FACE
              ? "Position your face"
              : challenge.phase === CHALLENGE_STATES.BLINK
                ? "Blink your eyes"
                : challenge.phase === CHALLENGE_STATES.HEAD_LEFT
                  ? "Turn your head LEFT"
                  : challenge.phase === CHALLENGE_STATES.HEAD_RIGHT
                    ? "Turn your head RIGHT"
                    : challenge.phase === CHALLENGE_STATES.RETURN_CENTER
                      ? "Look straight"
                      : "Position your face";
  const currentInstruction = isComplete
    ? "Liveness verification complete."
    : isTimedOut
      ? "Please try again."
      : isError
        ? "Please check camera permission and try again."
        : isMultipleFaces
          ? "Please keep only one face in view."
          : isFaceMissing
            ? "Please return your face to the camera."
            : challenge.phase === CHALLENGE_STATES.WAITING_FOR_FACE
              ? "Please position your face inside the camera view."
              : challenge.phase === CHALLENGE_STATES.BLINK
                ? "Please blink your eyes once."
                : challenge.phase === CHALLENGE_STATES.HEAD_LEFT
                  ? "Slowly turn your head to the left."
                  : challenge.phase === CHALLENGE_STATES.HEAD_RIGHT
                    ? "Slowly turn your head to the right."
                    : challenge.phase === CHALLENGE_STATES.RETURN_CENTER
                      ? "Please look straight at the camera."
                      : "Please position your face inside the camera view.";
  const currentHelper = isComplete
    ? "You can continue to the next step."
    : isTimedOut || isError
      ? ""
      : isMultipleFaces
        ? "Keep only one face visible to continue."
        : isFaceMissing
          ? "Keep your face inside the camera view."
          : challenge.phase === CHALLENGE_STATES.WAITING_FOR_FACE
            ? "Make sure your face is clearly visible."
            : challenge.phase === CHALLENGE_STATES.BLINK
              ? "Close and open your eyes naturally."
              : challenge.phase === CHALLENGE_STATES.HEAD_LEFT || challenge.phase === CHALLENGE_STATES.HEAD_RIGHT
                ? "Keep your face visible in the camera."
                : challenge.phase === CHALLENGE_STATES.RETURN_CENTER
                  ? "Keep your face centered for a moment."
                  : "Make sure your face is clearly visible.";
  const livenessStatus = isComplete
    ? { label: "Verified", icon: "✓", kind: "complete" }
    : isTimedOut
      ? { label: "Timed out", icon: "!", kind: "error" }
      : isError
        ? { label: "Unable to verify", icon: "!", kind: "error" }
        : challenge.phase === CHALLENGE_STATES.WAITING_FOR_FACE || isFaceMissing || isMultipleFaces
          ? { label: "Waiting for face", icon: "○", kind: "waiting" }
          : { label: "Verification in progress", icon: "◌", kind: "progress" };

  return (
    <main className="webcam-test-page">
      <header className="webcam-test-header">
        <h1>Liveness Verification</h1>
      </header>

      <section className="liveness-card" aria-label="Liveness verification">
        <div className="liveness-layout">
          <section
            className={`current-action ${isComplete ? "action-complete" : ""}`}
            role={isTimedOut || isError ? "alert" : "status"}
            aria-live={isTimedOut || isError ? "assertive" : "polite"}
          >
            <div className="current-action-meta">
              <span>{currentStepIndex >= 0 ? `STEP ${currentStepIndex + 1} OF 4` : "LIVENESS VERIFICATION"}</span>
              <span className="action-icon" aria-hidden="true">
                {challenge.phase === CHALLENGE_STATES.BLINK ? "◉" :
                  challenge.phase === CHALLENGE_STATES.HEAD_LEFT || challenge.phase === CHALLENGE_STATES.HEAD_RIGHT ? "↔" :
                    challenge.phase === CHALLENGE_STATES.RETURN_CENTER ? "◎" : isComplete ? "✓" : "⌖"}
              </span>
            </div>
            <h2>{currentTitle}</h2>
            {successFeedback && hasActiveFace && !isComplete && !isError && !isTimedOut && (
              <p className="transition-feedback" role="status">{successFeedback}</p>
            )}
            <p>{currentInstruction}</p>
            {currentHelper && <p className="current-action-helper">{currentHelper}</p>}
            {isComplete && completionConfirmationError && (
              <div className="completion-confirmation-error" role="alert">
                <p>{completionConfirmationError.message || "Could not confirm liveness verification."}</p>
                {!completionConfirmationError.code?.startsWith("LIVENESS_SESSION") && (
                  <button type="button" className="primary-button" onClick={confirmCompletion} disabled={isConfirmingCompletion}>
                    {isConfirmingCompletion ? "Confirming..." : "Retry confirmation"}
                  </button>
                )}
              </div>
            )}
          </section>

          {(isTimedOut || isError) && (
            <section className="error-panel">
              <button type="button" className="primary-button" onClick={tryAgain}>Try Again</button>
            </section>
          )}

          <div className="camera-column">
            <div className="camera-frame">
              <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" />
              <div className="camera-guide" aria-hidden="true" />
              {!isCameraConnected && (
                <div className="camera-placeholder">Your camera preview will appear here</div>
              )}
            </div>

            <div className={`face-indicator ${hasActiveFace ? "is-detected" : "is-missing"}`} role="status" aria-live="polite">
              <span aria-hidden="true">{hasActiveFace ? "●" : "○"}</span>
              {isMultipleFaces ? "More than one face detected" : hasActiveFace ? "Face detected" : "Face not detected"}
            </div>

            <div className="camera-controls">
              {!isCameraConnected && challenge.phase !== CHALLENGE_STATES.ERROR && (
                <button type="button" className="primary-button" onClick={startCamera} disabled={isStarting}>
                  {isStarting ? "Starting camera..." : "Start camera"}
                </button>
              )}
              {isCameraConnected && challenge.phase !== CHALLENGE_STATES.COMPLETED && (
                <button type="button" className="text-button" onClick={stopCamera}>Stop camera</button>
              )}
            </div>
          </div>

          <div className={`liveness-status status-${livenessStatus.kind}`} role="status" aria-live="polite">
            <span className="status-symbol" aria-hidden="true">{livenessStatus.icon}</span>
            <span><small>Liveness status</small><strong>{livenessStatus.label}</strong></span>
          </div>

          <section className="challenge-progress" aria-label="Verification steps">
            <div className="section-heading-row">
              <h2>Progress</h2>
              <span>{challengeProgress(challenge.phase)}</span>
            </div>
            <ol>
              {CHALLENGE_STEPS.map((step, index) => {
                const completed = isComplete || (currentStepIndex >= 0 && index < currentStepIndex);
                const current = !isComplete && currentStepIndex === index;
                const state = completed ? "COMPLETED" : current ? "CURRENT" : "PENDING";
                return (
                  <li key={step.phase} className={`step-${state.toLowerCase()}`} aria-current={current ? "step" : undefined}>
                    <span className="step-symbol" aria-hidden="true">{completed ? "✓" : current ? "→" : "○"}</span>
                    <span className="step-label">{step.label}</span>
                    <span className="step-state">{state}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <p className="privacy-note">Camera processing is performed locally. Successful FRONT, LEFT, and RIGHT captures are retained only for administrator identity review.</p>
        </div>
      </section>
    </main>
  );
};

export default WebcamTest;
