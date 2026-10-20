import classicRound from './assets/classic-round.svg';
import aviatorGold from './assets/aviator-gold.svg';
import catEyeTortoise from './assets/cat-eye-tortoise.svg';

// Dummy frames for trying the feature out - not products yet. Every image
// is drawn with its lens centres at (25%, 50%) and (75%, 50%) of the image,
// so the distance between the lens centres is half the image width.
//   widthScale - frame width as a multiple of the distance between the pupils
//   anchorY    - the lens-centre line, as a fraction of the image height
//   hingeY     - where the temple (side arm) joins the front, as a fraction
//                of the image height (the outer edge is the hinge)
//   temple     - colour(s) of the side arm, shown when the head is turned;
//                more than one colour is drawn as a gradient along the arm
export const SAMPLE_FRAMES = [
  { id: 'classic-round', name: 'Classic Round', color: 'Matte Black', image: classicRound, widthScale: 2.05, anchorY: 0.5, hingeY: 0.4, temple: { colors: ['#111111'], thickness: 0.055 } },
  { id: 'aviator-gold', name: 'Aviator', color: 'Gold / Green', image: aviatorGold, widthScale: 2.1, anchorY: 0.5, hingeY: 0.21, temple: { colors: ['#e0bd4a', '#a8831a'], thickness: 0.04 } },
  { id: 'cat-eye-tortoise', name: 'Cat Eye', color: 'Tortoise', image: catEyeTortoise, widthScale: 2.15, anchorY: 0.48, hingeY: 0.2, temple: { colors: ['#5a2d12', '#9c4a1a', '#3b1c0b', '#b8662a'], thickness: 0.07 } },
];

export const TRY_ON_MODES = {
  CAMERA: 'CAMERA',
  UPLOAD: 'UPLOAD',
};

// MediaPipe Face Landmarker (478-point model) points used. "Left"/"right"
// are as seen in the image.
export const LANDMARKS = {
  LEFT_IRIS: 468,
  RIGHT_IRIS: 473,
  NOSE_BRIDGE: 168,
  // Face outline beside each eye (head turn) and in front of each ear (temple end).
  LEFT_FACE_EDGE: 234,
  RIGHT_FACE_EDGE: 454,
  LEFT_EAR_TOP: 127,
  RIGHT_EAR_TOP: 356,
};

// Temples fade in between these head-turn angles (degrees); facing the
// camera they are hidden behind the frame, like real glasses.
export const TEMPLE_SHOW_FROM_DEG = 10;
export const TEMPLE_FULL_AT_DEG = 22;

const MEDIAPIPE_VERSION = '1.0.1'; // keep in step with package.json
export const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const FACE_LANDMARKER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const MAX_UPLOAD_MB = 10;
