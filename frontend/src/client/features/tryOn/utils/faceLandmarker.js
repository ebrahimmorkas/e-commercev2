import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_URL, FACE_LANDMARKER_MODEL_URL } from '../constants';

// One landmarker per running mode ('VIDEO' for the camera, 'IMAGE' for an
// uploaded photo), created on first use and kept for the rest of the visit.
// Everything runs in the browser - no image ever leaves the device.
const landmarkers = {};

const createLandmarker = async (runningMode) => {
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  const options = {
    baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: 'GPU' },
    runningMode,
    numFaces: 1,
  };
  try {
    return await FaceLandmarker.createFromOptions(fileset, options);
  } catch {
    // No WebGL / GPU delegate unavailable.
    return FaceLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  }
};

export const getFaceLandmarker = (runningMode) => {
  if (!landmarkers[runningMode]) {
    landmarkers[runningMode] = createLandmarker(runningMode).catch((error) => {
      delete landmarkers[runningMode]; // let the next attempt retry
      throw error;
    });
  }
  return landmarkers[runningMode];
};
