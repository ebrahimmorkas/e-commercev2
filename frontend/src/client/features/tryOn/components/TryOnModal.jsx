import { useEffect, useRef, useState } from 'react';
import Modal from '../../../../components/common/Modal/Modal';
import Spinner from '../../../../components/common/Spinner/Spinner';
import { SAMPLE_FRAMES, TRY_ON_MODES, MAX_UPLOAD_MB } from '../constants';
import { getFaceLandmarker } from '../utils/faceLandmarker';
import { drawSpectacles, loadImage } from '../utils/drawSpectacles';

const cameraErrorMessage = (error) => {
  if (error?.name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access in your browser, or upload a photo instead.';
  if (error?.name === 'NotFoundError') return 'No camera was found on this device. Upload a photo instead.';
  if (error?.name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  return 'Could not start the camera. Upload a photo instead.';
};

const MODEL_ERROR_MESSAGE = 'Could not load face detection. Check your internet connection and try again.';
const NO_FACE_MESSAGE = 'No face found - face the camera in good light.';

/**
 * Virtual Try-On: finds the face (live camera or an uploaded photo) and puts
 * the chosen spectacles on it. Face detection runs fully in the browser
 * (MediaPipe Face Landmarker) - the camera feed and photos never leave the
 * device. Mount it only while open so every visit starts clean.
 */
const TryOnModal = ({ onClose }) => {
  const [mode, setMode] = useState(TRY_ON_MODES.CAMERA);
  const [frameId, setFrameId] = useState(SAMPLE_FRAMES[0].id);
  const [status, setStatus] = useState('loading'); // loading | ready | error | empty
  const [message, setMessage] = useState('');
  const [faceFound, setFaceFound] = useState(true);
  const [photoUrl, setPhotoUrl] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const frameImagesRef = useRef({});
  const selectedFrameRef = useRef(SAMPLE_FRAMES[0]);
  const photoRef = useRef(null); // { image, landmarks }

  const selectedFrame = SAMPLE_FRAMES.find((frame) => frame.id === frameId) || SAMPLE_FRAMES[0];

  // Preload every frame image once.
  useEffect(() => {
    SAMPLE_FRAMES.forEach((frame) => {
      loadImage(frame.image)
        .then((image) => { frameImagesRef.current[frame.id] = image; })
        .catch(() => {});
    });
  }, []);

  // Draws the uploaded photo + spectacles (camera mode redraws every frame itself).
  const renderPhoto = () => {
    const canvas = canvasRef.current;
    const photo = photoRef.current;
    if (!canvas || !photo) return;
    if (canvas.width !== photo.image.naturalWidth || canvas.height !== photo.image.naturalHeight) {
      canvas.width = photo.image.naturalWidth;
      canvas.height = photo.image.naturalHeight;
    }
    const ctx = canvas.getContext('2d');
    ctx.drawImage(photo.image, 0, 0, canvas.width, canvas.height);
    drawSpectacles(ctx, photo.landmarks, frameImagesRef.current[selectedFrameRef.current.id], selectedFrameRef.current);
  };

  const handleSelectFrame = (frame) => {
    selectedFrameRef.current = frame;
    setFrameId(frame.id);
    if (mode === TRY_ON_MODES.UPLOAD) renderPhoto();
  };

  // Live camera: draw each video frame, find the face, draw the spectacles.
  useEffect(() => {
    if (mode !== TRY_ON_MODES.CAMERA) return undefined;

    const video = videoRef.current;
    let cancelled = false;
    let stream = null;
    let animationId = null;
    let lastVideoTime = -1;
    let lastFaceFound = true;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setMessage('This browser cannot open the camera here. Upload a photo instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(cameraErrorMessage(error));
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      video.srcObject = stream;
      let landmarker;
      try {
        await video.play();
        landmarker = await getFaceLandmarker('VIDEO');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage(MODEL_ERROR_MESSAGE);
        }
        return;
      }
      if (cancelled) return;
      setStatus('ready');

      const loop = () => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (canvas && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const result = landmarker.detectForVideo(video, performance.now());
          const landmarks = result.faceLandmarks?.[0];
          if (landmarks) {
            drawSpectacles(ctx, landmarks, frameImagesRef.current[selectedFrameRef.current.id], selectedFrameRef.current);
          }
          // Only re-render when it changes, not 30 times a second.
          if (!!landmarks !== lastFaceFound) {
            lastFaceFound = !!landmarks;
            setFaceFound(lastFaceFound);
          }
        }
        animationId = requestAnimationFrame(loop);
      };
      loop();
    };

    start();

    return () => {
      cancelled = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [mode]);

  // Free the uploaded photo's object URL when it is replaced or the modal closes.
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setMessage('');
    setFaceFound(true);
    if (nextMode === TRY_ON_MODES.CAMERA) {
      setStatus('loading');
    } else {
      setStatus(photoRef.current ? 'ready' : 'empty');
      // The canvas is reused, so put the photo back on it.
      requestAnimationFrame(renderPhoto);
    }
  };

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // picking the same file again should still fire
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setMessage('Please choose an image file (JPG, PNG or WEBP).');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setStatus('error');
      setMessage(`The photo must be ${MAX_UPLOAD_MB}MB or smaller.`);
      return;
    }

    setStatus('loading');
    setMessage('');
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    try {
      const [image, landmarker] = await Promise.all([loadImage(url), getFaceLandmarker('IMAGE')]);
      const result = landmarker.detect(image);
      const landmarks = result.faceLandmarks?.[0] || null;
      photoRef.current = { image, landmarks };
      setFaceFound(!!landmarks);
      setStatus('ready');
      renderPhoto();
    } catch {
      photoRef.current = null;
      setStatus('error');
      setMessage('Could not read this photo or load face detection. Try another photo.');
    }
  };

  const isCamera = mode === TRY_ON_MODES.CAMERA;
  const tabClass = (active) =>
    `flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
      active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <Modal isOpen onClose={onClose} title="Virtual Try-On" size="xl">
      <div className="space-y-4">
        <div className="flex gap-2 p-1 rounded-full bg-slate-100">
          <button type="button" className={tabClass(isCamera)} onClick={() => switchMode(TRY_ON_MODES.CAMERA)}>
            Live Camera
          </button>
          <button type="button" className={tabClass(!isCamera)} onClick={() => switchMode(TRY_ON_MODES.UPLOAD)}>
            Upload Photo
          </button>
        </div>

        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full object-contain ${isCamera ? '-scale-x-100' : ''} ${status === 'ready' ? '' : 'invisible'}`}
          />

          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-200">
              <Spinner size="lg" />
              <p className="text-sm">{isCamera ? 'Starting camera...' : 'Finding your face...'}</p>
            </div>
          )}

          {status === 'error' && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-300">{message}</p>
          )}

          {status === 'empty' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white cursor-pointer"
            >
              <span className="text-sm font-semibold">Choose a front-facing photo</span>
              <span className="text-xs text-slate-400">JPG, PNG or WEBP, up to {MAX_UPLOAD_MB}MB</span>
            </button>
          )}

          {status === 'ready' && !faceFound && (
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 text-xs text-white whitespace-nowrap">
              {isCamera ? NO_FACE_MESSAGE : 'No face found in this photo - try a clear, front-facing one.'}
            </p>
          )}
        </div>

        {!isCamera && (
          <div className="flex justify-center">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {photoUrl ? 'Choose another photo' : 'Upload photo'}
            </button>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">Choose a frame</p>
          <div className="grid grid-cols-3 gap-3">
            {SAMPLE_FRAMES.map((frame) => (
              <button
                key={frame.id}
                type="button"
                onClick={() => handleSelectFrame(frame)}
                className={`p-3 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                  frame.id === selectedFrame.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <img src={frame.image} alt={frame.name} className="w-full h-12 object-contain" />
                <p className="mt-2 text-sm font-semibold text-slate-800">{frame.name}</p>
                <p className="text-xs text-slate-500">{frame.color}</p>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">Your camera and photos stay on this device - nothing is uploaded.</p>
      </div>
    </Modal>
  );
};

export default TryOnModal;
