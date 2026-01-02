import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

type DistanceStatus = 'too_close' | 'too_far' | 'ok' | 'no_vehicle';

interface Props {
  onInspectionComplete: (summary: any) => void;
}

const TARGET_DURATION_SECONDS = 30; // Approximate time for a 360° walk-around
const DETECTION_INTERVAL = 6; // run detection every N frames to reduce load (when not recording)
const DETECTION_INTERVAL_RECORDING = 3; // more frequent detection when recording to track movement

// Detect if device is mobile
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
};

export const CameraInspection: React.FC<Props> = ({ onInspectionComplete }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const [isMobile] = useState(isMobileDevice());
  // Camera starts only after user clicks the button
  const [hasStarted, setHasStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus>('no_vehicle');
  const [distanceMessage, setDistanceMessage] = useState<string>('Center the vehicle in view to begin.');
  const [speedWarning, setSpeedWarning] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [vehicleDetected, setVehicleDetected] = useState<boolean>(false);

  const lastVehicleCenterRef = useRef<{ x: number; time: number } | null>(null);
  const lastDetectionBoxRef = useRef<Box | null>(null);
  const frameCounterRef = useRef(0);
  const lastDetectionTimeRef = useRef<number>(0);
  const detectionTimeoutRef = useRef<number>(0);
  const damageDetectionsRef = useRef<Array<{ box: Box; confidence: number; label: string }>>([]);

  useEffect(() => {
    if (!hasStarted) return;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error('Failed to access camera', err);
      }
    };
    void initCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, [hasStarted]);

  useEffect(() => {
    let animationFrameId: number;

    const analyzeFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animationFrameId = requestAnimationFrame(analyzeFrame);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(analyzeFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Vehicle detection (AI) – use more frequent detection when recording to track movement
      frameCounterRef.current += 1;
      const detectionInterval = isRecording ? DETECTION_INTERVAL_RECORDING : DETECTION_INTERVAL;
      const now = performance.now();
      
      if (model && frameCounterRef.current % detectionInterval === 0) {
        void model.detect(video).then((preds) => {
          const vehiclePred = selectVehiclePrediction(preds);
          if (vehiclePred) {
            const [x, y, width, height] = vehiclePred.bbox;
            lastDetectionBoxRef.current = { x, y, width, height };
            lastDetectionTimeRef.current = now;
            detectionTimeoutRef.current = 0; // Reset timeout on successful detection
          } else {
            // If no detection, check if we should clear the cached box
            // Only clear if we haven't detected for a while (helps during movement)
            const timeSinceLastDetection = now - lastDetectionTimeRef.current;
            if (timeSinceLastDetection > 1000) { // 1 second without detection
              lastDetectionBoxRef.current = null;
            }
          }
        });
      }
      
      // Clear detection if it's been too long since last successful detection (especially when recording)
      if (isRecording && lastDetectionBoxRef.current && lastDetectionTimeRef.current > 0) {
        const timeSinceLastDetection = now - lastDetectionTimeRef.current;
        if (timeSinceLastDetection > 2000) { // 2 seconds without detection during recording
          lastDetectionBoxRef.current = null;
          lastDetectionTimeRef.current = 0;
        }
      }

      // If model is loaded, rely on actual detections.
      // Before model is ready, use a centered fallback box so UI is still usable.
      let vehicleBox: Box | null;
      if (model) {
        vehicleBox = lastDetectionBoxRef.current;
        // If we have a cached box but it's been a while, validate it's still reasonable
        if (vehicleBox && lastDetectionTimeRef.current > 0) {
          const timeSinceLastDetection = now - lastDetectionTimeRef.current;
          // If detection is stale and we're not recording, be more lenient
          // If recording, we need fresher detections
          if (isRecording && timeSinceLastDetection > 1500) {
            vehicleBox = null; // Require fresher detection when recording
          }
        }
      } else {
        vehicleBox = approximateVehicleBox(canvas);
      }

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;

      if (vehicleBox) {
        // Heuristic: ignore tall, person-like boxes (height >> width).
        const aspect = vehicleBox.width / vehicleBox.height;
        if (aspect < 1.0) {
          vehicleBox = null;
        }
      }

      if (vehicleBox) {
        // Draw vehicle bounding box in green
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 3;
        ctx.strokeRect(vehicleBox.x, vehicleBox.y, vehicleBox.width, vehicleBox.height);

        // Detect damage within vehicle area (run less frequently for performance)
        if (frameCounterRef.current % (detectionInterval * 3) === 0) {
          detectDamageInVehicleArea(ctx, canvas, vehicleBox, damageDetectionsRef);
        }

        // Draw damage bounding boxes
        damageDetectionsRef.current.forEach((detection) => {
          drawDamageBox(ctx, detection.box, detection.confidence, detection.label);
        });

        const ratio = vehicleBox.width / canvas.width;
        let status: DistanceStatus;
        let message: string;

        if (ratio > 0.85) {
          status = 'too_close';
          message = 'Move back slightly – vehicle too large in frame.';
        } else if (ratio < 0.55) {
          status = 'too_far';
          message = 'Move closer to the car – vehicle too small in frame.';
        } else {
          status = 'ok';
          message = 'Good distance – continue walking slowly around the vehicle.';
        }

        setDistanceStatus(status);
        setDistanceMessage(message);
        setVehicleDetected(true); // Vehicle is detected and valid

        // Speed estimation based on horizontal movement of vehicle center.
        const centerX = vehicleBox.x + vehicleBox.width / 2;
        const now = performance.now();
        
        // Clear old damage detections if vehicle moved significantly
        if (lastVehicleCenterRef.current) {
          const dx = Math.abs(centerX - lastVehicleCenterRef.current.x);
          if (dx > 50) {
            // Vehicle moved, clear old damage detections
            damageDetectionsRef.current = [];
          }
        }
        const last = lastVehicleCenterRef.current;
        if (last) {
          const dx = Math.abs(centerX - last.x);
          const dt = (now - last.time) / 1000;
          const speed = dx / dt; // px/s (proxy)
          if (speed > 600) {
            setSpeedWarning('You are moving too fast. Slow down for better capture.');
          } else {
            setSpeedWarning(null);
          }
        }
        lastVehicleCenterRef.current = { x: centerX, time: now };
      } else {
        setDistanceStatus('no_vehicle');
        setDistanceMessage('Ensure the full vehicle is visible in frame.');
        setSpeedWarning(null);
        setVehicleDetected(false); // No vehicle detected
      }

      // Progress estimation: simple time-based proxy for 360° coverage.
      if (isRecording && startTime != null) {
        const elapsed = (performance.now() - startTime) / 1000;
        const pct = Math.min(100, (elapsed / TARGET_DURATION_SECONDS) * 100);
        setProgress(pct);
      }

      drawOverlayUI(ctx, canvas, distanceStatus, distanceMessage, speedWarning, progress, isMobile);

      animationFrameId = requestAnimationFrame(analyzeFrame);
    };

    if (hasStarted) {
      animationFrameId = requestAnimationFrame(analyzeFrame);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [distanceStatus, distanceMessage, isRecording, progress, speedWarning, startTime, hasStarted, model, isMobile]);

  // Load vehicle detector (COCO-SSD) once when component mounts.
  useEffect(() => {
    const loadModel = async () => {
      try {
        // Ensure a valid backend (webgl or cpu) is ready before loading the model.
        const backends = tf.engine().registryFactory;
        if (!tf.getBackend() || !(tf.getBackend() in backends)) {
          // Prefer webgl in browser; fall back to cpu.
          const preferred = backends.webgl ? 'webgl' : 'cpu';
          await tf.setBackend(preferred);
        }
        await tf.ready();

        const loaded = await cocoSsd.load();
        setModel(loaded);
      } catch (err) {
        console.error('Failed to load detection model', err);
        setModelError('Vehicle detector failed to load. Check console logs.');
      }
    };
    void loadModel();
  }, []);

  const beginInspection = () => {
    setHasStarted(true);
    setVehicleDetected(false); // Reset detection state when starting camera view
  };

  const startRecording = () => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;

    const stream = video.srcObject as MediaStream;
    recordedChunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      await uploadAndAnalyze(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setStartTime(performance.now());
    setProgress(0);
    // Reset detection tracking when starting recording to ensure fresh detections
    lastDetectionTimeRef.current = performance.now();
    frameCounterRef.current = 0; // Reset frame counter to trigger immediate detection
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const uploadAndAnalyze = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('video', blob, 'inspection.webm');
    
    // Get API URL from environment variable or use default
    // In production, set VITE_API_URL to your backend URL
    // In development, defaults to localhost:3001
    const env = (import.meta as any).env || {};
    const apiUrl = env.VITE_API_URL || (env.DEV !== false ? 'http://localhost:3001' : window.location.origin);
    const apiEndpoint = `${apiUrl}/api/process-video`;
    
    try {
      // Show analyzing state
      setIsAnalyzing(true);
      setDistanceMessage('Analyzing video...');
      
      console.log('Uploading video to:', apiEndpoint);
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Server error:', errorText);
        throw new Error(`Failed to process video: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('Video processed successfully:', data);
      setIsAnalyzing(false);
      onInspectionComplete(data);
    } catch (err) {
      console.error('Video processing error:', err);
      setIsAnalyzing(false);
      let errorMessage = 'Video processing failed. ';
      
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        errorMessage += '\n\n❌ Cannot connect to backend server.\n\n';
        errorMessage += 'Please ensure:\n';
        errorMessage += '1. Backend server is running (cd server && npm start)\n';
        errorMessage += '2. Server is accessible at: ' + apiUrl + '\n';
        errorMessage += '3. Check your .env file has VITE_API_URL set correctly';
      } else if (err instanceof Error) {
        errorMessage += err.message;
      } else {
        errorMessage += 'Please check your connection and ensure the backend server is running.';
      }
      
      alert(errorMessage);
    }
  };

  const distanceBadge = (() => {
    switch (distanceStatus) {
      case 'too_close':
        return { label: 'Too Close', className: 'badge badge-red' };
      case 'too_far':
        return { label: 'Too Far', className: 'badge badge-yellow' };
      case 'ok':
        return { label: 'Good Distance', className: 'badge badge-green' };
      default:
        return { label: 'No Vehicle Detected', className: 'badge badge-gray' };
    }
  })();

  if (!hasStarted) {
    return (
      <div className="landing-layout">
        <div className="landing-card">
          <div className="landing-icon">
            <span role="img" aria-label="camera">
              📷
            </span>
          </div>
          <h2>360° Vehicle Inspection</h2>
          <p className="landing-subtitle">
            Walk around your vehicle while recording to detect visible damage on all panels.
          </p>
          <div className="landing-instructions">
            <h3>Instructions</h3>
            <ol>
              <li>Position yourself 3–5 feet from the vehicle.</li>
              <li>Keep the entire vehicle in frame.</li>
              <li>Walk slowly around the vehicle (full 360°).</li>
              <li>Follow the on-screen guidance for distance and speed.</li>
            </ol>
          </div>
          {modelError ? (
            <div className="badge badge-red" style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>
              {modelError}
            </div>
          ) : !model ? (
            <div className="badge badge-gray" style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>
              Loading vehicle detector...
            </div>
          ) : null}
          <button className="primary-button landing-button" onClick={beginInspection}>
            Start 360° Video Inspection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`camera-layout ${isMobile ? 'camera-layout-mobile' : ''}`}>
      {/* Analyzing Overlay */}
      {isAnalyzing && (
        <div className="analyzing-overlay">
          <div className="analyzing-content">
            <div className="analyzing-spinner"></div>
            <h2>Analyzing Video</h2>
            <p>Please wait while we process your 360° inspection...</p>
          </div>
        </div>
      )}
      <div className={`camera-panel ${isMobile ? 'camera-panel-mobile' : ''}`}>
        <div className={`video-container ${isMobile ? 'video-container-mobile' : ''}`}>
          <video ref={videoRef} className="video-element" playsInline muted />
          <canvas ref={canvasRef} className="overlay-canvas" />
        </div>
        {!isMobile && (
          <>
            <div className="status-bar">
              <span className={distanceBadge.className}>{distanceBadge.label}</span>
              {speedWarning && <span className="badge badge-warning">{speedWarning}</span>}
              <div className="progress-container">
                <div className="progress-label">360° Coverage</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-percent">{progress.toFixed(0)}%</div>
              </div>
            </div>
            <div className="guidance-text">
              <p>{distanceMessage}</p>
              <p>Walk slowly around the car in a full circle while keeping it centered in the frame.</p>
            </div>
          </>
        )}
        <div className={`controls ${isMobile ? 'controls-mobile' : ''}`}>
          {!isRecording ? (
            <>
              <button 
                className={`primary-button ${isMobile ? 'primary-button-mobile' : ''}`}
                onClick={startRecording}
                disabled={!vehicleDetected}
                title={!vehicleDetected ? 'Please wait for vehicle detection before starting' : ''}
              >
                {isMobile ? 'Start Recording' : 'Start 360° Video Inspection'}
              </button>
              {!vehicleDetected && (
                <p className="button-hint" style={{ marginTop: 8, fontSize: isMobile ? 14 : 12, color: isMobile ? '#ffffff' : '#9ca3af', textAlign: 'center', textShadow: isMobile ? '0 1px 2px rgba(0,0,0,0.8)' : 'none' }}>
                  {isMobile ? 'Waiting for vehicle detection...' : 'Waiting for vehicle detection...'}
                </p>
              )}
            </>
          ) : (
            <button className={`secondary-button ${isMobile ? 'secondary-button-mobile' : ''}`} onClick={stopRecording}>
              {isMobile ? 'Stop & Analyze' : 'Complete Loop & Analyze'}
            </button>
          )}
        </div>
      </div>
      {!isMobile && (
        <aside className="info-panel">
          <h2>Phase-1 Scope</h2>
          <ul>
            <li>Live video with overlay guidance.</li>
            <li>Rule-based distance estimation from vehicle bounding box width.</li>
            <li>Speed warnings if user moves too quickly.</li>
            <li>Approximate 360° coverage progress indicator.</li>
            <li>Video upload for backend processing and basic damage detection.</li>
          </ul>
        </aside>
      )}
    </div>
  );
};

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Fallback when detection is unavailable.
function approximateVehicleBox(canvas: HTMLCanvasElement): Box | null {
  const paddingRatio = 0.1;
  const width = canvas.width * (1 - 2 * paddingRatio);
  const height = canvas.height * 0.6;
  const x = canvas.width * paddingRatio;
  const y = canvas.height * 0.2;
  if (canvas.width === 0 || canvas.height === 0) return null;
  return { x, y, width, height };
}

function drawOverlayUI(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  distanceStatus: DistanceStatus,
  distanceMessage: string,
  speedWarning: string | null,
  progress: number,
  isMobile: boolean = false
) {
  // Gradient vignette
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
  gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.0)');
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top guidance text - enhanced for mobile visibility
  const topText = 'Walk slowly around the vehicle to capture a full 360° view.';
  const topTextY = isMobile ? 70 : 36;
  const fontSize = isMobile ? 20 : 20;
  const fontWeight = isMobile ? 'bold' : 'normal';
  
  ctx.font = `${fontWeight} ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  
  // Add background for better visibility on mobile
  if (isMobile) {
    const textMetrics = ctx.measureText(topText);
    const textWidth = textMetrics.width;
    const padding = 20;
    const bgHeight = fontSize + padding * 1.5;
    const bgY = topTextY - fontSize - padding / 2;
    const bgWidth = Math.min(textWidth + padding * 2, canvas.width - 32); // Max width with margins
    
    // Draw more opaque background for better contrast
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.roundRect(
      (canvas.width - bgWidth) / 2,
      bgY,
      bgWidth,
      bgHeight,
      16
    );
    ctx.fill();
    
    // Add subtle border for definition
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.roundRect(
      (canvas.width - bgWidth) / 2,
      bgY,
      bgWidth,
      bgHeight,
      16
    );
    ctx.stroke();
  }
  
  // Draw text with stronger shadow for better visibility
  ctx.shadowColor = 'rgba(0, 0, 0, 1)';
  ctx.shadowBlur = isMobile ? 6 : 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = isMobile ? 2 : 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(topText, canvas.width / 2, topTextY);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Distance status pill - hide on mobile to avoid overlap with controls
  if (!isMobile) {
    let pillColor = '#888888';
    if (distanceStatus === 'too_close') pillColor = '#ff4b5c';
    else if (distanceStatus === 'too_far') pillColor = '#f5a623';
    else if (distanceStatus === 'ok') pillColor = '#11c770';

    const pillWidth = 260;
    const pillHeight = 34;
    const pillX = (canvas.width - pillWidth) / 2;
    const pillY = canvas.height - 90;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 18);
    ctx.fill();

    ctx.strokeStyle = pillColor;
    ctx.lineWidth = 2;
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 18);
    ctx.stroke();

    ctx.fillStyle = pillColor;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(distanceMessage, canvas.width / 2, pillY + 23);
  }

  // Speed warning - adjust position on mobile
  if (speedWarning) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const warningY = isMobile ? canvas.height - 200 : canvas.height - 150;
    ctx.fillRect(0, warningY, canvas.width, 30);
    ctx.fillStyle = '#ffcc00';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(speedWarning, canvas.width / 2, warningY + 22);
  }

  // Progress ring in top-right - enhanced for mobile visibility
  const centerX = isMobile ? canvas.width - 70 : canvas.width - 80;
  const centerY = isMobile ? 80 : 70;
  const radius = isMobile ? 35 : 30;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (2 * Math.PI * progress) / 100;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = isMobile ? 8 : 6;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.strokeStyle = '#11c770';
  ctx.lineWidth = isMobile ? 8 : 6;
  ctx.stroke();

  // Add background circle for better text visibility on mobile
  if (isMobile) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 4, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = isMobile ? 'bold 18px system-ui, sans-serif' : '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle'; // Center text vertically
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = isMobile ? 4 : 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = isMobile ? 2 : 1;
  ctx.fillText(`${Math.round(progress)}%`, centerX, centerY);
  
  // Reset shadow and text baseline
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.textBaseline = 'alphabetic'; // Reset to default

  ctx.restore();
}

function selectVehiclePrediction(
  predictions: cocoSsd.DetectedObject[]
): cocoSsd.DetectedObject | null {
  const allowed = new Set(['car', 'truck', 'bus', 'motorcycle']);
  const vehicleDetections = predictions.filter((p) => allowed.has(p.class));
  if (vehicleDetections.length === 0) return null;
  // Choose the largest detected vehicle by area.
  const sorted = vehicleDetections.sort((a, b) => {
    const areaA = a.bbox[2] * a.bbox[3];
    const areaB = b.bbox[2] * b.bbox[3];
    return areaB - areaA;
  });
  return sorted[0];
}

// Detect damage in the vehicle area using image analysis
function detectDamageInVehicleArea(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  vehicleBox: Box,
  damageDetectionsRef: React.MutableRefObject<Array<{ box: Box; confidence: number; label: string }>>
) {
  try {
    // Extract image data from vehicle area
    const imageData = ctx.getImageData(
      vehicleBox.x,
      vehicleBox.y,
      vehicleBox.width,
      vehicleBox.height
    );
    
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Simple damage detection heuristics:
    // 1. Look for areas with high contrast (scratches, dents)
    // 2. Look for irregular patterns
    // 3. Look for color anomalies
    
    const damageAreas: Array<{ x: number; y: number; width: number; height: number; confidence: number }> = [];
    const blockSize = 40; // Analyze in blocks
    const threshold = 0.3; // Sensitivity threshold
    
    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        let totalContrast = 0;
        let pixelCount = 0;
        let maxDiff = 0;
        
        // Calculate contrast and variance in this block
        for (let by = 0; by < blockSize && y + by < height; by++) {
          for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = (r + g + b) / 3;
            
            // Compare with neighbors
            if (bx > 0 && by > 0) {
              const prevIdx = ((y + by - 1) * width + (x + bx - 1)) * 4;
              const prevR = data[prevIdx];
              const prevG = data[prevIdx + 1];
              const prevB = data[prevIdx + 1];
              const prevBrightness = (prevR + prevG + prevB) / 3;
              
              const diff = Math.abs(brightness - prevBrightness);
              totalContrast += diff;
              maxDiff = Math.max(maxDiff, diff);
              pixelCount++;
            }
          }
        }
        
        const avgContrast = pixelCount > 0 ? totalContrast / pixelCount : 0;
        const contrastScore = avgContrast / 255; // Normalize to 0-1
        
        // Detect damage if contrast is high (scratches, dents create high contrast)
        if (contrastScore > threshold || maxDiff > 50) {
          const confidence = Math.min(0.95, 0.4 + (contrastScore * 0.5) + (maxDiff / 255) * 0.3);
          
          damageAreas.push({
            x: vehicleBox.x + x,
            y: vehicleBox.y + y,
            width: Math.min(blockSize, width - x),
            height: Math.min(blockSize, height - y),
            confidence: confidence
          });
        }
      }
    }
    
    // Merge nearby damage areas and update detections
    const merged = mergeNearbyBoxes(damageAreas);
    damageDetectionsRef.current = merged.map(area => ({
      box: { x: area.x, y: area.y, width: area.width, height: area.height },
      confidence: area.confidence,
      label: 'DAMAGE'
    }));
  } catch (error) {
    console.error('Damage detection error:', error);
  }
}

// Merge nearby bounding boxes
function mergeNearbyBoxes(
  boxes: Array<{ x: number; y: number; width: number; height: number; confidence: number }>
): Array<{ x: number; y: number; width: number; height: number; confidence: number }> {
  if (boxes.length === 0) return [];
  
  const merged: Array<{ x: number; y: number; width: number; height: number; confidence: number }> = [];
  const used = new Set<number>();
  
  for (let i = 0; i < boxes.length; i++) {
    if (used.has(i)) continue;
    
    let currentBox = { ...boxes[i] };
    used.add(i);
    
    // Find and merge nearby boxes
    for (let j = i + 1; j < boxes.length; j++) {
      if (used.has(j)) continue;
      
      const otherBox = boxes[j];
      const distance = Math.sqrt(
        Math.pow((currentBox.x + currentBox.width / 2) - (otherBox.x + otherBox.width / 2), 2) +
        Math.pow((currentBox.y + currentBox.height / 2) - (otherBox.y + otherBox.height / 2), 2)
      );
      
      // Merge if boxes are close (within 60 pixels)
      if (distance < 60) {
        const minX = Math.min(currentBox.x, otherBox.x);
        const minY = Math.min(currentBox.y, otherBox.y);
        const maxX = Math.max(currentBox.x + currentBox.width, otherBox.x + otherBox.width);
        const maxY = Math.max(currentBox.y + currentBox.height, otherBox.y + otherBox.height);
        
        currentBox = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          confidence: Math.max(currentBox.confidence, otherBox.confidence)
        };
        used.add(j);
      }
    }
    
    merged.push(currentBox);
  }
  
  return merged;
}

// Draw damage bounding box with label
function drawDamageBox(
  ctx: CanvasRenderingContext2D,
  box: Box,
  confidence: number,
  label: string
) {
  // Draw red bounding box
  ctx.strokeStyle = '#f44336';
  ctx.lineWidth = 3;
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  
  // Draw label background
  const labelText = `${label} ${Math.round(confidence * 100)}%`;
  ctx.font = 'bold 14px system-ui, sans-serif';
  const textMetrics = ctx.measureText(labelText);
  const labelWidth = textMetrics.width + 12;
  const labelHeight = 20;
  const labelX = box.x;
  const labelY = Math.max(0, box.y - labelHeight);
  
  // Draw label background
  ctx.fillStyle = '#f44336';
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
  
  // Draw label text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(labelText, labelX + 6, labelY + 3);
}

