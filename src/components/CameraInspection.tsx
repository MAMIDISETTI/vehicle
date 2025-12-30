import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

type DistanceStatus = 'too_close' | 'too_far' | 'ok' | 'no_vehicle';

interface Props {
  onInspectionComplete: (summary: any) => void;
}

const TARGET_DURATION_SECONDS = 30; // Approximate time for a 360° walk-around
const DETECTION_INTERVAL = 6; // run detection every N frames to reduce load

export const CameraInspection: React.FC<Props> = ({ onInspectionComplete }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const [hasStarted, setHasStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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

      // Vehicle detection (AI) – use cached detection except every DETECTION_INTERVAL frames.
      frameCounterRef.current += 1;
      if (model && frameCounterRef.current % DETECTION_INTERVAL === 0) {
        void model.detect(video).then((preds) => {
          const vehiclePred = selectVehiclePrediction(preds);
          if (vehiclePred) {
            const [x, y, width, height] = vehiclePred.bbox;
            lastDetectionBoxRef.current = { x, y, width, height };
          } else {
            lastDetectionBoxRef.current = null;
          }
        });
      }

      // If model is loaded, rely only on actual detections.
      // Before model is ready, use a centered fallback box so UI is still usable.
      let vehicleBox: Box | null;
      if (model) {
        vehicleBox = lastDetectionBoxRef.current;
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
        ctx.strokeRect(vehicleBox.x, vehicleBox.y, vehicleBox.width, vehicleBox.height);

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

      drawOverlayUI(ctx, canvas, distanceStatus, distanceMessage, speedWarning, progress);

      animationFrameId = requestAnimationFrame(analyzeFrame);
    };

    if (hasStarted) {
      animationFrameId = requestAnimationFrame(analyzeFrame);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [distanceStatus, distanceMessage, isRecording, progress, speedWarning, startTime, hasStarted, model]);

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
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const uploadAndAnalyze = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('video', blob, 'inspection.webm');
    try {
      const res = await fetch('/api/process-video', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        throw new Error('Failed to process video');
      }
      const data = await res.json();
      onInspectionComplete(data);
    } catch (err) {
      console.error(err);
      alert('Video processing failed. Check backend logs.');
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
    <div className="camera-layout">
      <div className="camera-panel">
        <div className="video-container">
          <video ref={videoRef} className="video-element" playsInline muted />
          <canvas ref={canvasRef} className="overlay-canvas" />
        </div>
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
        <div className="controls">
          {!isRecording ? (
            <>
              <button 
                className="primary-button" 
                onClick={startRecording}
                disabled={!vehicleDetected}
                title={!vehicleDetected ? 'Please wait for vehicle detection before starting' : ''}
              >
                Start 360° Video Inspection
              </button>
              {!vehicleDetected && (
                <p className="button-hint" style={{ marginTop: 8, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  Waiting for vehicle detection...
                </p>
              )}
            </>
          ) : (
            <button className="secondary-button" onClick={stopRecording}>
              Complete Loop &amp; Analyze
            </button>
          )}
        </div>
      </div>
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
  progress: number
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

  // Top guidance text
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Walk slowly around the vehicle to capture a full 360° view.', canvas.width / 2, 36);

  // Distance status pill
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

  // Speed warning
  if (speedWarning) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, canvas.height - 150, canvas.width, 30);
    ctx.fillStyle = '#ffcc00';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(speedWarning, canvas.width / 2, canvas.height - 128);
  }

  // Progress ring in top-right
  const centerX = canvas.width - 80;
  const centerY = 70;
  const radius = 30;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (2 * Math.PI * progress) / 100;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.strokeStyle = '#11c770';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(progress)}%`, centerX, centerY + 5);

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


